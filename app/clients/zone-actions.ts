"use server";
// Zone d'exclusivité d'un client (bloc de la fiche /clients/[id]) : saisie, géocodage, contrôle, garde 7 jours, réservation.
// Règle absolue : jamais de chevauchement entre deux clients de même activité, et jamais de doute transformé en « libre ».
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/workspace";
import { getClient, updateClient, type Client } from "@/lib/clients/store";
import { geocoder } from "@/lib/geocode";
import { nettoyerTexte } from "@/lib/zone-validation";
import {
  ACTIVITE_AUTRE, GARDE_APRES_APPEL_JOURS, RAYONS_PROPOSES, activiteReconnue, controleZone, expirationPour, pointValide,
  type Point,
} from "@/lib/zones";
import { deplacerZone, enregistrerZone, zoneDuClient, zonesOccupees, type SourceCoordonnees } from "@/lib/zones-store";

async function owner() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
}

/** Retour sur la fiche avec un message (ok: ou err:), ancré sur le bloc. redirect() lève : à appeler hors try/catch. */
function retour(id: string, ok: boolean, message: string): never {
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}?zone=${encodeURIComponent(`${ok ? "ok" : "err"}:${message}`.slice(0, 400))}#zone`);
}

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").trim().replace(",", "."));

interface Champs {
  activite: string;
  adresse: string;
  lien: string;
  rayonKm: number;
  manuel: (Point & { source: SourceCoordonnees }) | null;
  verifiee: boolean;
  erreur: string | null;
}

function lireChamps(form: FormData): Champs {
  const choix = nettoyerTexte(form.get("activite"));
  const activite = activiteReconnue(choix) ?? (choix === ACTIVITE_AUTRE.id ? ACTIVITE_AUTRE.id : "");
  const adresse = nettoyerTexte(form.get("adresse")).slice(0, 200);
  const lien = nettoyerTexte(form.get("lien")).slice(0, 500);
  const rayonKm = num(form.get("rayon"));
  let erreur: string | null = null;
  if (lien && !/^https?:\/\/\S+$/i.test(lien)) erreur = "Le lien de la fiche Google doit commencer par https://.";
  if (/[<>]/.test(adresse)) erreur = "L'adresse ne peut pas contenir de balises HTML.";
  let manuel: Champs["manuel"] = null;
  // Les champs de coordonnées sont préremplis : on ne les prend en compte que s'ils ont été modifiés à la main
  // (sinon un simple enregistrement figerait les coordonnées et empêcherait de géocoder à nouveau).
  const lat = String(form.get("lat") ?? "").trim();
  const lng = String(form.get("lng") ?? "").trim();
  const modifiees = lat !== String(form.get("lat0") ?? "").trim() || lng !== String(form.get("lng0") ?? "").trim();
  if ((lat || lng) && modifiees) {
    const p = { lat: num(form.get("lat")), lng: num(form.get("lng")) };
    if (!lat || !lng || !pointValide(p)) erreur = "Coordonnées non valides (latitude entre -90 et 90, longitude entre -180 et 180).";
    else manuel = { ...p, source: form.get("origine") === "fiche_google" ? "fiche_google" : "manuel" };
  }
  return { activite, adresse, lien, rayonKm, manuel, verifiee: form.get("verifiee") === "on", erreur };
}

const COORDS = ["zone_lat", "zone_lng", "zone_commune", "zone_precision", "zone_source"] as const;

/** Réponses de la fiche mises à jour avec les champs du bloc. Une adresse modifiée efface les anciennes coordonnées. */
function reponsesAvec(c: Client, f: Champs): Record<string, string> {
  const a: Record<string, string> = { ...(c.answers ?? {}) };
  if (f.activite) a.activite_exclusive = f.activite;
  if (f.adresse) a.adresse_etablissement = f.adresse;
  if (f.lien) a.lien_fiche_google = f.lien; else delete a.lien_fiche_google;
  if (RAYONS_PROPOSES.includes(f.rayonKm as (typeof RAYONS_PROPOSES)[number])) a.rayon_km = String(f.rayonKm);
  const adresseChangee = !!f.adresse && f.adresse !== (c.answers?.adresse_etablissement ?? "");
  if (adresseChangee) for (const k of COORDS) delete a[k];
  if (f.manuel) {
    a.zone_lat = String(f.manuel.lat);
    a.zone_lng = String(f.manuel.lng);
    a.zone_source = f.manuel.source;
    delete a.zone_commune;
    delete a.zone_precision;
  }
  return a;
}

function pointDe(a: Record<string, string>): Point | null {
  const p = { lat: Number(a.zone_lat), lng: Number(a.zone_lng) };
  return a.zone_lat && a.zone_lng && pointValide(p) ? p : null;
}

function sourceDe(a: Record<string, string>): SourceCoordonnees {
  return a.zone_source === "fiche_google" || a.zone_source === "manuel" ? a.zone_source : "ban";
}

async function chargerEtChamps(form: FormData): Promise<{ c: Client; f: Champs }> {
  await owner();
  const id = String(form.get("id") ?? "");
  const c = await getClient(id);
  if (!c) redirect("/clients");
  const f = lireChamps(form);
  if (f.erreur) retour(id, false, f.erreur);
  return { c, f };
}

/** Géocode l'adresse (API Adresse) si besoin et enregistre les coordonnées dans les réponses. */
async function geocoderDans(c: Client, a: Record<string, string>): Promise<{ a: Record<string, string>; erreur: string | null }> {
  const adresse = a.adresse_etablissement ?? "";
  if (adresse.length < 5) return { a, erreur: "Indique l'adresse de l'établissement." };
  const g = await geocoder(adresse);
  if (!g) {
    return { a, erreur: "Adresse non reconnue avec assez de certitude. Complète l'adresse (numéro, rue, code postal, commune) ou saisis les coordonnées à la main." };
  }
  const next = { ...a, zone_lat: String(g.lat), zone_lng: String(g.lng), zone_commune: g.commune, zone_precision: g.precision, zone_source: "ban" };
  return { a: next, erreur: null };
}

/** Enregistre les champs du bloc, sans géocoder. */
export async function enregistrerChampsZoneAction(form: FormData) {
  const { c, f } = await chargerEtChamps(form);
  const avant = c.answers?.adresse_etablissement ?? "";
  const a = reponsesAvec(c, f);
  await updateClient(c.id, { answers: a });
  const adresseChangee = !!f.adresse && f.adresse !== avant;
  retour(c.id, true, adresseChangee && !f.manuel ? "Champs enregistrés. L'adresse a changé : géocode à refaire." : "Champs enregistrés.");
}

/** Géocode l'adresse. Si la zone existe déjà (déménagement, correction), recalcule son centre et signale tout chevauchement. */
export async function geocoderZoneAction(form: FormData) {
  const { c, f } = await chargerEtChamps(form);
  let a = reponsesAvec(c, f);
  if (!f.manuel) {
    const r = await geocoderDans(c, a);
    if (r.erreur) {
      await updateClient(c.id, { answers: a });
      retour(c.id, false, r.erreur);
    }
    a = r.a;
  }
  await updateClient(c.id, { answers: a });

  const point = pointDe(a);
  const zone = await zoneDuClient(c.id).catch(() => null);
  if (zone && zone.statut !== "libere" && point) {
    const rayon = RAYONS_PROPOSES.includes(f.rayonKm as (typeof RAYONS_PROPOSES)[number]) ? f.rayonKm : zone.rayonKm;
    let occupees;
    try {
      occupees = await zonesOccupees(zone.activite);
    } catch {
      retour(c.id, false, "Zones illisibles : le centre n'a pas été modifié.");
    }
    const ctrl = controleZone(zone.activite, point, rayon, occupees, { exclureClientId: c.id });
    if (ctrl.etat !== "libre") {
      retour(c.id, false, ctrl.etat === "inconnue"
        ? "Contrôle impossible : la zone enregistrée garde son ancien centre."
        : `Le nouveau centre chevauche la zone d'un autre client (rayon maximal ${ctrl.rayonMaxKm ?? 0} km). La zone enregistrée garde son ancien centre.`);
    }
    try {
      await deplacerZone(zone.id, {
        adresse: a.adresse_etablissement ?? zone.adresse, commune: a.zone_commune ?? null, lat: point.lat, lng: point.lng,
        source: sourceDe(a), rayonKm: rayon, lienFicheGoogle: f.lien || null,
      });
    } catch (e) {
      retour(c.id, false, `Enregistrement impossible : ${e instanceof Error ? e.message : "erreur inconnue"}.`);
    }
    retour(c.id, true, "Centre de la zone recalculé : aucun chevauchement.");
  }
  retour(c.id, true, "Adresse géocodée.");
}

async function prendreZone(form: FormData, statut: "gardee" | "reserve") {
  const { c, f } = await chargerEtChamps(form);
  const id = c.id;
  if (!f.activite || f.activite === ACTIVITE_AUTRE.id) {
    retour(id, false, "Choisis une activité de la liste : « Autre activité » se vérifie à la main, sans réservation automatique.");
  }
  if (!RAYONS_PROPOSES.includes(f.rayonKm as (typeof RAYONS_PROPOSES)[number])) retour(id, false, "Choisis un rayon.");
  if (f.adresse.length < 5 && (c.answers?.adresse_etablissement ?? "").length < 5) retour(id, false, "Indique l'adresse de l'établissement.");
  if (statut === "reserve" && !f.verifiee) {
    retour(id, false, "Confirme d'abord que l'adresse correspond à la fiche Google Business (Maps).");
  }

  let a = reponsesAvec(c, f);
  if (!pointDe(a)) {
    const r = await geocoderDans(c, a);
    if (r.erreur) {
      await updateClient(id, { answers: a });
      retour(id, false, r.erreur);
    }
    a = r.a;
  }
  const point = pointDe(a)!;
  // Un centre de rue ou de commune n'est pas assez précis pour bloquer un territoire.
  if (a.zone_precision && a.zone_precision !== "adresse") {
    await updateClient(id, { answers: a });
    retour(id, false, "L'adresse est trop imprécise (centre de rue ou de commune). Ajoute le numéro, ou saisis les coordonnées à la main.");
  }

  let occupees;
  try {
    occupees = await zonesOccupees(f.activite);
  } catch {
    retour(id, false, "Zones illisibles : rien n'a été enregistré. Réessaie.");
  }
  const ctrl = controleZone(f.activite, point, f.rayonKm, occupees, { exclureClientId: id });
  if (ctrl.etat !== "libre") {
    await updateClient(id, { answers: a });
    retour(id, false, ctrl.etat === "partielle"
      ? `Cette zone chevauche celle d'un autre client. Rayon maximal possible : ${ctrl.rayonMaxKm} km.`
      : ctrl.etat === "prise"
        ? "Zone prise : elle chevauche celle d'un autre client."
        : `Contrôle impossible (${ctrl.raison ?? "doute"}) : rien n'a été enregistré.`);
  }

  const courante = await zoneDuClient(id).catch(() => null);
  const deja = courante && (courante.statut === "reserve" || courante.statut === "actif");
  if (statut === "gardee" && deja) retour(id, false, "La zone est déjà réservée pour ce client.");
  // Une zone déjà réservée ou active garde son statut quand on la réserve de nouveau (mise à jour du centre ou du rayon).
  const statutFinal = statut === "reserve" && deja ? courante!.statut : statut;
  const expire = statutFinal === "gardee" ? expirationPour("gardee") : null;

  try {
    await enregistrerZone(id, {
      activite: f.activite, adresse: a.adresse_etablissement, commune: a.zone_commune ?? null, lat: point.lat, lng: point.lng,
      source: sourceDe(a), lienFicheGoogle: f.lien || null, rayonKm: f.rayonKm,
    }, statutFinal, expire);
    if (f.verifiee) a.zone_adresse_verifiee = new Date().toISOString();
    await updateClient(id, { answers: a });
  } catch (e) {
    retour(id, false, `Enregistrement impossible : ${e instanceof Error ? e.message : "erreur inconnue"}. Vérifie que la migration 0024 est lancée.`);
  }

  const jusquau = expire ? new Date(expire).toLocaleDateString("fr-FR") : "";
  retour(id, true, statutFinal === "gardee"
    ? `Zone gardée ${GARDE_APRES_APPEL_JOURS} jours, jusqu'au ${jusquau}. Sans signature, elle est libérée seule.`
    : "Zone réservée. Elle reste bloquée tant que le client est actif.");
}

export async function gardeZoneAction(form: FormData) { return prendreZone(form, "gardee"); }
export async function reserverZoneAction(form: FormData) { return prendreZone(form, "reserve"); }
