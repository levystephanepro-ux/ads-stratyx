// Libère les zones expirées (garde de 7 jours non signée, libération de 30 jours après arrêt)
// et prévient par e-mail quand une zone libérée correspond à la liste d'attente (Vercel Cron, voir vercel.json).
import { NextResponse } from "next/server";
import { sendAgentEmail } from "@/lib/agent/email";
import { attenteConcernee, expirerZones } from "@/lib/zones-store";
import { libelleActivite } from "@/lib/zones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const liberees = await expirerZones();
    const attente = await attenteConcernee(liberees);
    let email = "rien à signaler";
    if (attente.length) {
      const lignes = attente.map((a) =>
        `- **${libelleActivite(a.activite)}** · ${a.adresse} : ${a.etat === "libre" ? `libre pour ${a.rayonKm} km` : `libre jusqu'à ${a.rayonMaxKm} km (demandé : ${a.rayonKm} km)`}`);
      try {
        await sendAgentEmail(`📍 Zone libérée · ${attente.length} personne(s) en liste d'attente`, ["# Zone libérée", "", ...lignes].join("\n"));
        email = "envoyé";
      } catch (e) {
        email = `non envoyé : ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    return NextResponse.json({ ranAt: new Date().toISOString(), liberees: liberees.length, attente: attente.length, email });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
