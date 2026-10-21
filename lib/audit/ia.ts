// Relecture par l'IA, sur demande (≈ 1 crédit), des 3 critères de jugement de l'audit :
// titres, fautes d'orthographe et de style, cohérence entre l'annonce et la page.
// Le résultat est enregistré par compte et réappliqué à chaque nouveau scan.
import Anthropic from "@anthropic-ai/sdk";
import { isLive } from "@/lib/google-ads/config";
import { searchRaw } from "@/lib/google-ads/client";
import { getSetting, setSetting } from "@/lib/agent/store";
import { calcCost, addMonthlyCost } from "@/lib/agent/cost";
import { getGlobalBilling } from "@/lib/billing";
import { getAccountContext } from "@/lib/account-context";

export const IA_LABELS = {
  titres: "Titres : bonnes pratiques et biais cognitifs",
  fautes: "Fautes d'orthographe et de style",
  coherence: "Cohérence entre l'annonce et la page",
} as const;
export type IaKey = keyof typeof IA_LABELS;
export type IaVerdict = { status: "ok" | "warn" | "bad"; detail: string };
export interface IaReview { at: string; results: Record<IaKey, IaVerdict> }

const key = (customerId: string) => `audit_ia:${customerId}`;
export async function readIa(customerId: string): Promise<IaReview | null> {
  try { const raw = await getSetting(key(customerId)); return raw ? (JSON.parse(raw) as IaReview) : null; } catch { return null; }
}

interface AdText { group: string; headlines: string[]; descriptions: string[]; url: string }

async function readAds(customerId: string): Promise<AdText[]> {
  if (!isLive()) {
    return [{ group: "Fenêtres PVC", headlines: ["Fenêtres sur mesure La Farlède", "Devis gratuit sous 48 h", "Pose par nos artisans", "Jusqu'à 40 % d'économie d'énergie"], descriptions: ["Menuiseries PVC et alu, fabriquées sur mesure. Demandez votre devis gratuit.", "Installateur certifié RGE, garantie décennale. Aides disponibles."], url: "https://example.org/" }];
  }
  const rows = await searchRaw({ customerId }, `
    SELECT ad_group.name, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions
    FROM ad_group_ad
    WHERE ad_group_ad.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED' AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
    LIMIT 10`);
  return rows.map((r) => {
    const rsa = r.adGroupAd?.ad?.responsiveSearchAd ?? {};
    return {
      group: String(r.adGroup?.name ?? ""),
      headlines: ((rsa.headlines ?? []) as { text?: string }[]).map((h) => h.text ?? "").filter(Boolean),
      descriptions: ((rsa.descriptions ?? []) as { text?: string }[]).map((h) => h.text ?? "").filter(Boolean),
      url: String(((r.adGroupAd?.ad?.finalUrls ?? []) as string[])[0] ?? ""),
    };
  }).filter((a) => a.headlines.length);
}

async function readPage(url: string): Promise<string> {
  if (!/^https?:\/\//.test(url)) return "";
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "user-agent": "Mozilla/5.0 (compatible; StratyxAudit/1.0)" } });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 5000);
  } catch { return ""; }
}

const MODEL = "claude-haiku-4-5-20251001";

/** Lance la relecture, l'enregistre et la renvoie. Environ 1 crédit. */
export async function runIaReview(customerId: string, accountName: string): Promise<IaReview> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Clé API Anthropic manquante (ANTHROPIC_API_KEY).");
  const billing = await getGlobalBilling();
  if (!billing.allowed) throw new Error(billing.reason ?? "Plafond IA du mois atteint.");
  const ads = await readAds(customerId);
  if (!ads.length) throw new Error("Aucune annonce responsive active à relire.");
  const page = await readPage(ads.find((a) => a.url)?.url ?? "");
  const ctx = await getAccountContext(customerId, null).catch(() => "");

  const facts = [
    `Compte : ${accountName}`,
    ctx ? `Contexte de l'entreprise : ${ctx.slice(0, 1200)}` : "",
    "", "ANNONCES (groupe, titres, descriptions) :",
    ...ads.slice(0, 6).map((a, i) => `#${i + 1} [${a.group}]\n  Titres : ${a.headlines.join(" | ")}\n  Descriptions : ${a.descriptions.join(" | ")}`),
    "", page ? `TEXTE DE LA PAGE DE DESTINATION (${ads.find((a) => a.url)?.url}) :\n${page}` : "PAGE DE DESTINATION : illisible (non évaluable).",
  ].filter((x) => x !== undefined).join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: MODEL, max_tokens: 900,
    system: "Tu es un media buyer Google Ads francophone qui audite des annonces Search. Tu juges uniquement sur les textes fournis, sans rien inventer. Phrases courtes, concrètes, sans tiret long, sans emoji.",
    messages: [{ role: "user", content: `${facts}\n\nRéponds UNIQUEMENT par un objet JSON, sans texte autour, de la forme :\n{"titres":{"status":"ok|warn|bad","detail":"..."},"fautes":{"status":"ok|warn|bad","detail":"..."},"coherence":{"status":"ok|warn|bad","detail":"..."}}\n\n- titres : les titres ont-ils un bénéfice, un chiffre, une preuve, un appel à l'action, le mot-clé repris ? Cite un exemple de titre à améliorer ou à garder.\n- fautes : fautes d'orthographe, de grammaire, de typographie ou de style dans les titres et descriptions. Cite la faute exacte et sa correction, ou dis qu'il n'y en a pas.\n- coherence : la promesse de l'annonce (offre, prix, délai, aides, zone) est-elle présente sur la page ? Si la page est illisible, status "warn" et dis-le.\nstatus : ok = rien à corriger, warn = à améliorer, bad = problème net. detail : 200 caractères maximum, en français.` }],
  });
  const usage = calcCost(MODEL, res.usage.input_tokens, res.usage.output_tokens);
  await addMonthlyCost(usage.costUsd, "agent", null).catch(() => undefined);

  const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let parsed: Partial<Record<IaKey, { status?: string; detail?: string }>>;
  try { parsed = JSON.parse(json); } catch { throw new Error("Réponse de l'IA illisible, réessaie."); }
  const one = (k: IaKey): IaVerdict => {
    const p = parsed[k];
    const status = p?.status === "ok" || p?.status === "bad" ? p.status : "warn";
    return { status, detail: String(p?.detail ?? "Pas de retour de l'IA.").slice(0, 200) };
  };
  const review: IaReview = { at: new Date().toISOString(), results: { titres: one("titres"), fautes: one("fautes"), coherence: one("coherence") } };
  await setSetting(key(customerId), JSON.stringify(review));
  return review;
}
