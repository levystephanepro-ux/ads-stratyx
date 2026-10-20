// Vérification publique d'une zone + création de la fiche prospect + e-mail.
// Ne renvoie QUE : etat, rayonMaxKm, suggestions (noms de communes), indicatif, supplement, demandeId,
// et un message pour « Autre activité ». Jamais le nom, l'adresse ou les coordonnées d'un client,
// ni le contenu de la table des zones.
import { NextResponse } from "next/server";
import { sendAgentEmail } from "@/lib/agent/email";
import { getAppUrl } from "@/lib/app-url";
import { createZoneLead } from "@/lib/clients/store";
import { ipDe, limite } from "@/lib/rate-limit";
import { verifierZone } from "@/lib/zone-check";
import { nettoyerTexte, validerAutreActivite, type AutreActiviteValide } from "@/lib/zone-validation";
import {
  MESSAGE_ACTIVITE_AUTRE, RAYONS_PROPOSES, activiteReconnue, estAutreActivite, libelleActivite, supplementMensuel,
} from "@/lib/zones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_TEL = /^(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;

const texte = (v: unknown, max: number) => nettoyerTexte(v).slice(0, max);

export async function POST(req: Request) {
  if (limite(`zone:${ipDe(req)}`, 8, 3600_000)) {
    return NextResponse.json({ error: "trop_de_demandes" }, { status: 429 });
  }

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "requete_invalide" }, { status: 400 });
  }

  // Piège anti-robots : un champ caché rempli reçoit une fausse réponse, rien n'est enregistré.
  if (texte(b.site_web, 100)) {
    return NextResponse.json({ etat: "inconnue", suggestions: [], indicatif: false, supplement: 0 });
  }

  const choix = texte(b.activite, 80);
  const adresse = texte(b.adresse, 200);
  const rayonKm = Number(b.rayonKm);
  const nom = texte(b.nom, 100);
  const telephone = texte(b.telephone, 30);
  const email = texte(b.email, 120);
  const situation = texte(b.situation, 100);

  const erreurs: Record<string, string> = {};

  // Activité : identifiant de la liste, ou « autre » avec ses trois champs validés et nettoyés ici.
  const autreChoisi = estAutreActivite(choix);
  const activiteId = autreChoisi ? "autre" : activiteReconnue(choix);
  let autre: AutreActiviteValide | undefined;
  if (!activiteId) {
    erreurs.activite = "Choisissez votre activité.";
  } else if (autreChoisi) {
    const r = validerAutreActivite({ autreActivite: b.autreActivite, panierMoyen: b.panierMoyen, description: b.description });
    if (r.ok) autre = r.valeurs;
    else Object.assign(erreurs, r.erreurs);
  }

  if (adresse.length < 5) erreurs.adresse = "Indiquez l'adresse de votre établissement.";
  if (!(RAYONS_PROPOSES as readonly number[]).includes(rayonKm)) erreurs.rayonKm = "Choisissez un rayon.";
  if (nom.length < 2) erreurs.nom = "Indiquez votre nom.";
  if (!RE_TEL.test(telephone)) erreurs.telephone = "Numéro non reconnu. Format attendu : 06 12 34 56 78.";
  if (!RE_EMAIL.test(email)) erreurs.email = "Adresse email non valide.";
  if (b.consentement !== true) erreurs.consentement = "Votre accord est nécessaire pour vous recontacter.";
  if (Object.keys(erreurs).length || !activiteId) {
    return NextResponse.json({ error: "validation", erreurs }, { status: 400 });
  }

  const libelle = libelleActivite(activiteId);
  const v = await verifierZone(activiteId, adresse, rayonKm);

  let demandeId: string;
  try {
    demandeId = await createZoneLead({
      nom, telephone, email, situation, activite: activiteId, activiteLibelle: libelle, autre,
      adresse, rayonKm, etat: v.etat, indicatif: v.indicatif,
      geo: v.geo && { lat: v.geo.lat, lng: v.geo.lng, commune: v.geo.commune, precision: v.geo.precision },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "trop_de_demandes") {
      return NextResponse.json({ error: "trop_de_demandes" }, { status: 429 });
    }
    return NextResponse.json({ error: "enregistrement_impossible" }, { status: 500 });
  }

  // L'e-mail à Stéphane ne bloque jamais la réponse : la fiche est déjà enregistrée.
  try {
    const lignes = [
      "# Nouvelle vérification de zone", "",
      `- **État** : ${v.etat}${v.indicatif ? " (adresse imprécise, à confirmer)" : ""}${v.rayonMaxKm !== undefined ? `, rayon libre jusqu'à ${v.rayonMaxKm} km` : ""}`,
      `- **Activité** : ${libelle}`,
    ];
    if (autre) {
      lignes.push(
        `- **Activité indiquée** : ${autre.autreActivite}`,
        `- **Panier moyen estimé** : ${autre.panierMoyen} euros`,
        `- **Ce qu'il vend** : ${autre.description || "non précisé"}`,
        "- **À faire** : vérifier manuellement les zones existantes",
      );
    }
    lignes.push(
      `- **Adresse de l'établissement** : ${v.geo?.libelle ?? adresse}`,
      `- **Rayon demandé** : ${rayonKm} km`,
      `- **Nom** : ${nom}`,
      `- **Téléphone** : ${telephone}`,
      `- **Email** : ${email}`,
      `- **Situation** : ${situation || "non précisée"}`,
      "", `Fiche : ${getAppUrl()}/clients/${demandeId}`,
    );
    await sendAgentEmail(
      autre
        ? `📍 Autre activité à vérifier à la main · ${autre.autreActivite} · ${v.geo?.commune || adresse}`
        : `📍 Zone ${v.etat.toUpperCase()}${v.indicatif ? " (indicatif)" : ""} · ${libelle} · ${v.geo?.commune || adresse}`,
      lignes.join("\n"),
    );
  } catch {
    // Pas d'e-mail configuré ou erreur Resend : la demande reste visible dans /clients.
  }

  return NextResponse.json({
    etat: v.etat,
    rayonMaxKm: v.rayonMaxKm,
    suggestions: v.suggestions,
    indicatif: v.indicatif,
    supplement: supplementMensuel(rayonKm, 1),
    demandeId,
    ...(v.autre ? { message: MESSAGE_ACTIVITE_AUTRE } : {}),
  });
}
