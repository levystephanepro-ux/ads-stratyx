// Inscription sur la liste d'attente d'une zone prise ou partielle.
// Les coordonnées viennent de la fiche créée par /api/zone/check, jamais du navigateur.
import { NextResponse } from "next/server";
import { sendAgentEmail } from "@/lib/agent/email";
import { getAppUrl } from "@/lib/app-url";
import { SOURCE_VERIFICATION_ZONE, getClient, updateClient } from "@/lib/clients/store";
import { ipDe, limite } from "@/lib/rate-limit";
import { ajouterAttente } from "@/lib/zones-store";
import { libelleActivite, pointValide } from "@/lib/zones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (limite(`attente:${ipDe(req)}`, 10, 3600_000)) {
    return NextResponse.json({ error: "trop_de_demandes" }, { status: 429 });
  }
  let id = "";
  try {
    id = String(((await req.json()) as { demandeId?: unknown }).demandeId ?? "");
  } catch {
    return NextResponse.json({ error: "requete_invalide" }, { status: 400 });
  }
  if (!RE_UUID.test(id)) return NextResponse.json({ error: "requete_invalide" }, { status: 400 });

  const c = await getClient(id);
  const a = c?.answers ?? {};
  const recente = !!c && Date.now() - Date.parse(c.created_at) < 24 * 3600_000;
  const point = { lat: Number(a.zone_lat), lng: Number(a.zone_lng) };
  if (!c || a.source !== SOURCE_VERIFICATION_ZONE || !recente || !pointValide(point) || !["prise", "partielle"].includes(a.zone_etat)) {
    return NextResponse.json({ error: "demande_introuvable" }, { status: 404 });
  }
  if (a.liste_attente === "oui") return NextResponse.json({ ok: true });

  try {
    await ajouterAttente({
      activite: a.activite_exclusive, adresse: a.adresse_etablissement, lat: point.lat, lng: point.lng,
      rayonKm: Number(a.rayon_km), clientId: c.id,
    });
    await updateClient(c.id, { answers: { ...a, liste_attente: "oui" } });
  } catch {
    return NextResponse.json({ error: "enregistrement_impossible" }, { status: 500 });
  }

  try {
    await sendAgentEmail(
      `⏳ Liste d'attente · ${libelleActivite(a.activite_exclusive)} · ${a.zone_commune || a.adresse_etablissement}`,
      `${c.name} (${c.contact_phone ?? "sans téléphone"}) s'inscrit sur la liste d'attente, rayon ${a.rayon_km} km.\n\nFiche : ${getAppUrl()}/clients/${c.id}`,
    );
  } catch {
    // L'inscription est enregistrée même sans e-mail.
  }
  return NextResponse.json({ ok: true });
}
