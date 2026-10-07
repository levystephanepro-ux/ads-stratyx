"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/workspace";
import { getClient, updateClient } from "@/lib/clients/store";
import { getProposal } from "@/lib/clients/proposal";
import { suggestQuote } from "@/lib/clients/quote-ai";
import { stageOf, stageRank } from "@/lib/clients/stages";
import {
  getQuoteSettings, saveQuoteSettings, getQuote, saveQuote, nextQuoteNumber, linesFromForm, withAmounts,
  lineFromCatalog, varContext, UNITES, type CatalogItem, type Offer, type Quote, type Unite,
} from "@/lib/clients/quotes";

async function owner() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, d = 0) => { const n = Number(str(f, k).replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : d; };
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24);

// ---------------- Réglages : coordonnées, catalogue, packs ----------------
export async function saveQuoteSettingsAction(form: FormData) {
  await owner();
  const prev = await getQuoteSettings();

  const catalogue: CatalogItem[] = [];
  const ids = new Set<string>();
  const nCat = Math.round(num(form, "nCat", 0));
  for (let i = 0; i < nCat; i++) {
    const titre = str(form, `c${i}_titre`);
    if (!titre || form.get(`c${i}_suppr`) === "on") continue;
    let id = str(form, `c${i}_id`) || slug(titre) || `p${i}`;
    while (ids.has(id)) id = `${id}_${i}`;
    ids.add(id);
    const u = str(form, `c${i}_unite`);
    catalogue.push({
      id, cat: str(form, `c${i}_cat`) || "Accompagnement", titre: titre.slice(0, 160), detail: str(form, `c${i}_detail`).slice(0, 1200),
      unite: (u in UNITES ? u : "forfait") as Unite, prix: num(form, `c${i}_prix`), qte: num(form, `c${i}_qte`, 1) || 1,
      type: str(form, `c${i}_type`) === "mensuel" ? "mensuel" : "unique", quand: str(form, `c${i}_quand`).slice(0, 300),
    });
  }

  const offres: Offer[] = [];
  const nPack = Math.round(num(form, "nPack", 0));
  for (let k = 0; k < nPack; k++) {
    const nom = str(form, `p${k}_nom`);
    if (!nom || form.get(`p${k}_suppr`) === "on") continue;
    const items = form.getAll(`p${k}_items`).map(String).filter((id) => ids.has(id));
    offres.push({ nom, engagementMois: Math.round(num(form, `p${k}_engagement`, 3)), notes: str(form, `p${k}_notes`), items, lignes: prev.offres[k]?.lignes ?? [] });
  }

  await saveQuoteSettings({
    raisonSociale: str(form, "raisonSociale"), adresse: str(form, "adresse"), email: str(form, "email"), telephone: str(form, "telephone"),
    siret: str(form, "siret"), mentionTva: str(form, "mentionTva"), validiteJours: Math.round(num(form, "validiteJours", 30)),
    conditionsPaiement: str(form, "conditionsPaiement"), garantie: str(form, "garantie"),
    catalogue: catalogue.length ? catalogue : prev.catalogue, offres: offres.length ? offres : prev.offres,
  });
  const back = str(form, "back");
  redirect(back.startsWith("/") ? back : "/clients/devis-reglages?ok=1");
}

// ---------------- Création d'un devis ----------------
async function baseQuote(id: string): Promise<Pick<Quote, "numero" | "date" | "statut" | "garantie">> {
  const [existing, s] = await Promise.all([getQuote(id), getQuoteSettings()]);
  return { numero: existing?.numero ?? await nextQuoteNumber(), date: new Date().toISOString(), statut: "brouillon", garantie: !!s.garantie };
}

/** Depuis un pack : prestations du catalogue, variables remplies avec la fiche et la proposition. */
export async function createQuoteAction(form: FormData) {
  await owner();
  const id = str(form, "id");
  const c = await getClient(id);
  if (!c) return;
  const s = await getQuoteSettings();
  const offer = s.offres[Math.round(num(form, "offre", 0))] ?? s.offres[0];
  const prop = await getProposal(id).catch(() => null);
  const budget = prop?.proposal.budget_mensuel || null;
  const ctx = varContext(c, { budget, nbCampagnes: prop?.proposal.campagnes.length || null });
  const byId = new Map(s.catalogue.map((it) => [it.id, it]));
  const fromItems = (offer?.items ?? []).map((i) => byId.get(i)).filter((x): x is CatalogItem => !!x)
    .map((it) => lineFromCatalog(it, ctx, { qte: it.id === "search" && prop?.proposal.campagnes.length ? prop.proposal.campagnes.length : undefined }));
  const lignes = fromItems.length ? fromItems : offer?.lignes ?? [];
  await saveQuote(id, {
    ...(await baseQuote(id)), offreNom: offer?.nom ?? "Accompagnement", lignes: withAmounts(lignes, budget),
    engagementMois: offer?.engagementMois ?? 3, budgetPub: budget, notes: offer?.notes ?? "",
  });
  redirect(`/clients/${id}/devis?edit=1`);
}

export async function createBlankQuoteAction(form: FormData) {
  await owner();
  const id = str(form, "id");
  if (!(await getClient(id))) return;
  const prop = await getProposal(id).catch(() => null);
  await saveQuote(id, { ...(await baseQuote(id)), offreNom: "Accompagnement en acquisition payante", lignes: [], engagementMois: 3, budgetPub: prop?.proposal.budget_mensuel || null, notes: "" });
  redirect(`/clients/${id}/devis?edit=1`);
}

/** L'IA choisit les prestations (création, ou remplacement des lignes d'un devis existant). */
export async function aiQuoteAction(form: FormData) {
  await owner();
  const id = str(form, "id");
  const c = await getClient(id);
  if (!c) return;
  const [s, prop, existing] = await Promise.all([getQuoteSettings(), getProposal(id).catch(() => null), getQuote(id)]);
  let sug;
  try { sug = await suggestQuote(c, s, prop); }
  catch (e) { redirect(`/clients/${id}/devis?${existing ? "edit=1&" : ""}err=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`); }
  const base = existing ? { numero: existing.numero, date: existing.date, statut: existing.statut, garantie: existing.garantie } : await baseQuote(id);
  await saveQuote(id, {
    ...base, offreNom: sug.offreNom, lignes: withAmounts(sug.lignes, sug.budgetPub), engagementMois: sug.engagementMois,
    budgetPub: sug.budgetPub, notes: sug.notes || existing?.notes || "", remiseGlobale: existing?.remiseGlobale ?? 0,
    ia: { raisons: sug.raisons, model: sug.model, at: new Date().toISOString() },
  });
  redirect(`/clients/${id}/devis?edit=1&ia=1`);
}

// ---------------- Enregistrement ----------------
export async function saveQuoteAction(form: FormData) { await saveQuoteCore(form, false); }
export async function saveQuoteStayAction(form: FormData) { await saveQuoteCore(form, true); }

async function saveQuoteCore(form: FormData, stay: boolean) {
  await owner();
  const id = str(form, "id");
  const c = await getClient(id);
  const q = await getQuote(id);
  if (!c || !q) return;
  const statut = (["brouillon", "envoye", "accepte", "refuse"] as const).find((x) => x === str(form, "statut")) ?? q.statut;
  const budgetStr = str(form, "budgetPub");
  const budgetPub = budgetStr ? num(form, "budgetPub") : null;

  let lignes = linesFromForm(form, 60);
  // Ajouts depuis le catalogue (cases cochées).
  const add = form.getAll("add").map(String);
  if (add.length) {
    const s = await getQuoteSettings();
    const ctx = varContext(c, { budget: budgetPub, nbCampagnes: null });
    const byId = new Map(s.catalogue.map((it) => [it.id, it]));
    lignes = [...lignes, ...add.map((x) => byId.get(x)).filter((x): x is CatalogItem => !!x).map((it) => lineFromCatalog(it, ctx))];
  }

  await saveQuote(id, {
    ...q, offreNom: str(form, "offreNom") || q.offreNom, lignes: withAmounts(lignes, budgetPub),
    engagementMois: Math.round(num(form, "engagementMois", q.engagementMois)), budgetPub, notes: str(form, "notes"),
    garantie: form.get("garantie") === "on", statut, remiseGlobale: Math.min(100, num(form, "remiseGlobale")),
    date: form.get("redate") === "on" ? new Date().toISOString() : q.date,
  });
  // L'étape commerciale suit le devis.
  const r = stageRank(stageOf(c));
  const target = statut === "accepte" ? "signe" : statut === "envoye" ? "proposition" : statut === "refuse" ? "perdu" : null;
  if (target && (target === "perdu" || stageRank(target) > r)) await updateClient(id, { stage: target }).catch(() => undefined);
  revalidatePath(`/clients/${id}`);
  redirect(add.length || stay ? `/clients/${id}/devis?edit=1` : `/clients/${id}/devis`);
}
