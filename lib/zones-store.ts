// Accès base des zones d'exclusivité (migration 0024), service_role, serveur seulement.
// Une erreur de lecture est propagée : l'appelant doit alors répondre « inconnue », jamais « libre ».
import { createClient } from "@supabase/supabase-js";
import { getSetting, setSetting } from "@/lib/agent/store";
import { lireEchec, synchroniserAvecJournal, type EchecSynchro } from "@/lib/zones-sync";
import {
  activiteReconnue, controleZone, distanceKm, transitionZone, zonesAExpirer,
  type StatutZone, type ZoneOccupee,
} from "@/lib/zones";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface LigneZone {
  id: string; client_id: string | null; activite: string; lat: number; lng: number;
  rayon_km: number | string; statut: StatutZone; expire_le: string | null;
}

const COLONNES = "id, client_id, activite, lat, lng, rayon_km, statut, expire_le";

function versZone(r: LigneZone): ZoneOccupee {
  return {
    activite: r.activite, lat: Number(r.lat), lng: Number(r.lng), rayonKm: Number(r.rayon_km),
    statut: r.statut, expireLe: r.expire_le, clientId: r.client_id,
  };
}

/** Zones susceptibles de bloquer une activité (le contrôle écarte ensuite les zones expirées). */
export async function zonesOccupees(activite: string): Promise<ZoneOccupee[]> {
  const act = activiteReconnue(activite);
  if (!act) return [];
  const { data, error } = await db()
    .from("zones_exclusives").select(COLONNES)
    .eq("activite", act).in("statut", ["gardee", "reserve", "actif", "liberation"]);
  if (error) throw new Error(`zones illisibles : ${error.message}`);
  return ((data ?? []) as LigneZone[]).map(versZone);
}

export interface ZoneLiberee { id: string; activite: string; lat: number; lng: number; rayonKm: number }
export interface AttenteConcernee {
  activite: string; adresse: string; rayonKm: number; rayonMaxKm: number | undefined; etat: "libre" | "partielle"; clientId: string | null;
}

/** Passe à « libere » les zones gardées ou en libération dont la date est dépassée. */
export async function expirerZones(maintenant: Date = new Date()): Promise<ZoneLiberee[]> {
  const { data, error } = await db()
    .from("zones_exclusives").select(COLONNES).in("statut", ["gardee", "liberation"]);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as LigneZone[]).map((r) => ({ id: r.id, statut: r.statut, expireLe: r.expire_le, r }));
  const aLiberer = zonesAExpirer(rows, maintenant);
  if (!aLiberer.length) return [];
  // Filtre sur le statut : une zone passée à « reserve » entre-temps n'est jamais libérée.
  const { data: maj, error: e2 } = await db()
    .from("zones_exclusives").update({ statut: "libere" })
    .in("id", aLiberer.map((z) => z.id)).in("statut", ["gardee", "liberation"]).select("id");
  if (e2) throw new Error(e2.message);
  const ok = new Set((maj ?? []).map((m: { id: string }) => m.id));
  return aLiberer.filter((z) => ok.has(z.id)).map(({ r }) => ({
    id: r.id, activite: r.activite, lat: Number(r.lat), lng: Number(r.lng), rayonKm: Number(r.rayon_km),
  }));
}

/** Entrées de la liste d'attente qui peuvent obtenir (tout ou partie de) leur zone après une libération. */
export async function attenteConcernee(liberees: ZoneLiberee[], maintenant: Date = new Date()): Promise<AttenteConcernee[]> {
  if (!liberees.length) return [];
  const activites = [...new Set(liberees.map((z) => z.activite))];
  const { data, error } = await db()
    .from("zones_attente").select("activite, adresse, lat, lng, rayon_km, client_id").in("activite", activites);
  if (error) throw new Error(error.message);
  const occupees = new Map<string, ZoneOccupee[]>();
  const res: AttenteConcernee[] = [];
  for (const a of (data ?? []) as { activite: string; adresse: string; lat: number; lng: number; rayon_km: number | string; client_id: string | null }[]) {
    const p = { lat: Number(a.lat), lng: Number(a.lng) };
    const rayon = Number(a.rayon_km);
    if (!liberees.some((z) => z.activite === a.activite && distanceKm(p, z) < rayon + z.rayonKm)) continue;
    if (!occupees.has(a.activite)) occupees.set(a.activite, await zonesOccupees(a.activite));
    const c = controleZone(a.activite, p, rayon, occupees.get(a.activite)!, { maintenant });
    if (c.etat === "libre" || c.etat === "partielle") {
      res.push({ activite: a.activite, adresse: a.adresse, rayonKm: rayon, rayonMaxKm: c.rayonMaxKm, etat: c.etat, clientId: a.client_id });
    }
  }
  return res;
}

/** Inscription d'un prospect sur la liste d'attente d'une zone prise. */
export async function ajouterAttente(e: { activite: string; adresse: string; lat: number; lng: number; rayonKm: number; clientId: string }): Promise<void> {
  const act = activiteReconnue(e.activite);
  if (!act) throw new Error("activité non reconnue");
  const { error } = await db().from("zones_attente").insert({
    activite: act, adresse: e.adresse, lat: e.lat, lng: e.lng, rayon_km: e.rayonKm, client_id: e.clientId,
  });
  if (error) throw new Error(error.message);
}

/* ----------------------- Zone d'un client (fiche /clients/[id]) ----------------------- */

export type SourceCoordonnees = "ban" | "fiche_google" | "manuel";

export interface ZoneClient {
  id: string;
  clientId: string;
  activite: string;
  adresse: string;
  commune: string | null;
  lat: number;
  lng: number;
  source: SourceCoordonnees;
  lienFicheGoogle: string | null;
  rayonKm: number;
  statut: StatutZone;
  expireLe: string | null;
  createdAt: string;
}

const COLONNES_CLIENT =
  "id, client_id, activite, adresse, commune, lat, lng, source_coordonnees, lien_fiche_google, rayon_km, statut, expire_le, created_at";

interface LigneZoneClient {
  id: string; client_id: string; activite: string; adresse: string; commune: string | null; lat: number; lng: number;
  source_coordonnees: SourceCoordonnees; lien_fiche_google: string | null; rayon_km: number | string;
  statut: StatutZone; expire_le: string | null; created_at: string;
}

function versZoneClient(r: LigneZoneClient): ZoneClient {
  return {
    id: r.id, clientId: r.client_id, activite: r.activite, adresse: r.adresse, commune: r.commune,
    lat: Number(r.lat), lng: Number(r.lng), source: r.source_coordonnees, lienFicheGoogle: r.lien_fiche_google,
    rayonKm: Number(r.rayon_km), statut: r.statut, expireLe: r.expire_le, createdAt: r.created_at,
  };
}

/** Zone en cours du client (la plus récente non libérée), sinon la dernière zone libérée, sinon null. */
export async function zoneDuClient(clientId: string): Promise<ZoneClient | null> {
  const { data, error } = await db()
    .from("zones_exclusives").select(COLONNES_CLIENT).eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const zones = ((data ?? []) as LigneZoneClient[]).map(versZoneClient);
  return zones.find((z) => z.statut !== "libere") ?? zones[0] ?? null;
}

export interface DonneesZone {
  activite: string;
  adresse: string;
  commune: string | null;
  lat: number;
  lng: number;
  source: SourceCoordonnees;
  lienFicheGoogle: string | null;
  rayonKm: number;
}

/** Crée la zone du client, ou met à jour sa zone en cours, avec le statut demandé. */
export async function enregistrerZone(
  clientId: string, d: DonneesZone, statut: StatutZone, expireLe: string | null,
): Promise<void> {
  const act = activiteReconnue(d.activite);
  if (!act) throw new Error("activité non reconnue");
  const courante = await zoneDuClient(clientId);
  const valeurs = {
    activite: act, adresse: d.adresse, commune: d.commune, lat: d.lat, lng: d.lng,
    source_coordonnees: d.source, lien_fiche_google: d.lienFicheGoogle, rayon_km: d.rayonKm,
    statut, expire_le: expireLe,
  };
  if (courante && courante.statut !== "libere") {
    const { error } = await db().from("zones_exclusives").update(valeurs).eq("id", courante.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await db().from("zones_exclusives").insert({ client_id: clientId, ...valeurs });
  if (error) throw new Error(error.message);
}

/** Met à jour le centre et le rayon de la zone en cours, sans toucher au statut. */
export async function deplacerZone(zoneId: string, d: Pick<DonneesZone, "adresse" | "commune" | "lat" | "lng" | "source" | "rayonKm" | "lienFicheGoogle">): Promise<void> {
  const { error } = await db().from("zones_exclusives").update({
    adresse: d.adresse, commune: d.commune, lat: d.lat, lng: d.lng, source_coordonnees: d.source,
    rayon_km: d.rayonKm, lien_fiche_google: d.lienFicheGoogle,
  }).eq("id", zoneId);
  if (error) throw new Error(error.message);
}

export interface ResultatSynchro {
  /** Statut posé, ou null si rien n'a changé. */
  statut: StatutZone | null;
  /** La zone n'a pas pu être reprise : une autre zone du même métier la chevauche. */
  conflit: boolean;
}

/**
 * Aligne la zone du client sur l'étape de sa fiche (voir transitionZone). Appelée à chaque changement d'étape,
 * d'où qu'il vienne : une fiche passée à « Signé » bloque sa zone sans autre action.
 */
export async function synchroniserZone(clientId: string, stage: string, maintenant: Date = new Date()): Promise<ResultatSynchro> {
  const zone = await zoneDuClient(clientId);
  if (!zone) return { statut: null, conflit: false };
  const t = transitionZone(stage, zone, maintenant);
  if (!t) return { statut: null, conflit: false };

  if (t.reverification) {
    // La zone ne bloquait plus rien : un autre client a pu la prendre entre-temps. Jamais de chevauchement.
    const occupees = await zonesOccupees(zone.activite);
    const c = controleZone(zone.activite, zone, zone.rayonKm, occupees, { exclureClientId: clientId, maintenant });
    if (c.etat !== "libre") return { statut: null, conflit: true };
  }
  const { error } = await db().from("zones_exclusives").update({ statut: t.statut, expire_le: t.expireLe }).eq("id", zone.id);
  if (error) throw new Error(error.message);
  return { statut: t.statut, conflit: false };
}

/* ------------------- Échecs de synchronisation (affichés sur la fiche) ------------------- */

const cleEchec = (clientId: string) => `zone_sync_echec:${clientId}`;

export async function echecSynchro(clientId: string): Promise<EchecSynchro | null> {
  return lireEchec(await getSetting(cleEchec(clientId)).catch(() => null));
}

/** Aligne la zone sur l'étape sans jamais lever : un échec est écrit dans les logs et noté pour la fiche. */
export function synchroniserZoneSansBloquer(clientId: string, stage: string): Promise<boolean> {
  return synchroniserAvecJournal({
    synchroniser: synchroniserZone,
    noter: (id, echec) => setSetting(cleEchec(id), JSON.stringify(echec)),
    effacer: async (id) => {
      // Évite une écriture inutile quand il n'y a aucun échec à effacer.
      if (await getSetting(cleEchec(id)).catch(() => null)) await setSetting(cleEchec(id), "");
    },
    journal: (message, detail) => console.error(message, detail),
  }, clientId, stage);
}

export async function effacerEchecSynchro(clientId: string): Promise<void> {
  if (await getSetting(cleEchec(clientId)).catch(() => null)) await setSetting(cleEchec(clientId), "");
}

/** Libère la zone en cours du client tout de suite (sans attendre les 30 jours). Renvoie false s'il n'y avait rien à libérer. */
export async function libererZoneMaintenant(clientId: string): Promise<boolean> {
  const zone = await zoneDuClient(clientId);
  if (!zone || zone.statut === "libere") return false;
  const { data, error } = await db()
    .from("zones_exclusives").update({ statut: "libere", expire_le: null })
    .eq("id", zone.id).in("statut", ["gardee", "reserve", "actif", "liberation"]).select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}
