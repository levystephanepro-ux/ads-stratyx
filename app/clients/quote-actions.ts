"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/workspace";
import { getClient, updateClient } from "@/lib/clients/store";
import { getProposal } from "@/lib/clients/proposal";
import { stageOf, stageRank } from "@/lib/clients/stages";
import { getQuoteSettings, saveQuoteSettings, getQuote, saveQuote, nextQuoteNumber, linesFromForm, type Offer, type Quote } from "@/lib/clients/quotes";

async function owner() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, d = 0) => { const n = Number(str(f, k).replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : d; };

export async function saveQuoteSettingsAction(form: FormData) {
  await owner();
  const offres: Offer[] = [];
  for (let k = 0; k < 3; k++) {
    const nom = str(form, `o${k}_nom`);
    if (!nom) continue;
    const sub = new FormData();
    for (let i = 0; i < 8; i++) for (const f of ["libelle", "type", "montant"]) { const v = form.get(`o${k}_l${i}_${f}`); if (v !== null) sub.set(`l${i}_${f}`, v); }
    offres.push({ nom, engagementMois: Math.round(num(form, `o${k}_engagement`, 3)), notes: str(form, `o${k}_notes`), lignes: linesFromForm(sub, 8) });
  }
  await saveQuoteSettings({
    raisonSociale: str(form, "raisonSociale"), adresse: str(form, "adresse"), email: str(form, "email"), telephone: str(form, "telephone"),
    siret: str(form, "siret"), mentionTva: str(form, "mentionTva"), validiteJours: Math.round(num(form, "validiteJours", 30)),
    conditionsPaiement: str(form, "conditionsPaiement"), garantie: str(form, "garantie"), offres,
  });
  const back = str(form, "back");
  redirect(back.startsWith("/") ? back : "/clients/devis-reglages?ok=1");
}

export async function createQuoteAction(form: FormData) {
  await owner();
  const id = str(form, "id");
  const c = await getClient(id);
  if (!c) return;
  const s = await getQuoteSettings();
  const offer = s.offres[Math.round(num(form, "offre", 0))] ?? s.offres[0];
  const prop = await getProposal(id).catch(() => null);
  const existing = await getQuote(id);
  const q: Quote = {
    numero: existing?.numero ?? await nextQuoteNumber(), date: new Date().toISOString(),
    offreNom: offer?.nom ?? "Accompagnement", lignes: offer?.lignes ?? [], engagementMois: offer?.engagementMois ?? 3,
    budgetPub: prop?.proposal.budget_mensuel ?? null, notes: offer?.notes ?? "", garantie: !!s.garantie, statut: "brouillon",
  };
  await saveQuote(id, q);
  redirect(`/clients/${id}/devis?edit=1`);
}

export async function saveQuoteAction(form: FormData) {
  await owner();
  const id = str(form, "id");
  const c = await getClient(id);
  const q = await getQuote(id);
  if (!c || !q) return;
  const statut = (["brouillon", "envoye", "accepte", "refuse"] as const).find((x) => x === str(form, "statut")) ?? q.statut;
  const budget = str(form, "budgetPub");
  await saveQuote(id, {
    ...q, offreNom: str(form, "offreNom") || q.offreNom, lignes: linesFromForm(form, 10), engagementMois: Math.round(num(form, "engagementMois", q.engagementMois)),
    budgetPub: budget ? num(form, "budgetPub") : null, notes: str(form, "notes"), garantie: form.get("garantie") === "on", statut,
    date: form.get("redate") === "on" ? new Date().toISOString() : q.date,
  });
  // L'étape commerciale suit le devis.
  const r = stageRank(stageOf(c));
  const target = statut === "accepte" ? "signe" : statut === "envoye" ? "proposition" : statut === "refuse" ? "perdu" : null;
  if (target && (target === "perdu" || stageRank(target) > r)) await updateClient(id, { stage: target }).catch(() => undefined);
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}/devis`);
}
