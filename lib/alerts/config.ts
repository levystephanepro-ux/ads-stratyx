// Configuration des alertes (app_settings, clé « alerts_config », JSON).
// Modèles prêts à l'emploi + règles personnalisées. Sans IA.
import { getSetting, setSetting } from "@/lib/agent/store";

export type TemplateKey = "compte_arret" | "depense_emballe" | "sans_conversion" | "cpa_hausse" | "budget_mois" | "pages_erreur";

export const TEMPLATES: { key: TemplateKey; label: string; hint: string; param?: { label: string; def: number; unit: string } }[] = [
  { key: "compte_arret", label: "Compte à l'arrêt", hint: "Aucune dépense hier alors que le compte dépensait les 7 jours d'avant (paiement refusé, campagnes en pause, annonces refusées)." },
  { key: "depense_emballe", label: "Dépense qui s'emballe", hint: "Dépense d'hier bien au-dessus de la moyenne des 7 jours précédents.", param: { label: "Seuil", def: 2, unit: "× la moyenne" } },
  { key: "sans_conversion", label: "Plus de conversions", hint: "Aucune conversion depuis N jours alors que le compte dépense (suivi cassé, formulaire en panne).", param: { label: "Depuis", def: 5, unit: "jours" } },
  { key: "cpa_hausse", label: "Coût par conversion en hausse", hint: "CPA des 7 derniers jours au-dessus du CPA des 30 jours d'avant (3 conversions minimum).", param: { label: "Seuil", def: 1.5, unit: "× le CPA habituel" } },
  { key: "budget_mois", label: "Budget du mois dépassé", hint: "Projection de fin de mois au-dessus du budget mensuel saisi sur l'accueil.", param: { label: "Tolérance", def: 10, unit: "%" } },
  { key: "pages_erreur", label: "Pages de destination en erreur", hint: "Une URL finale d'annonce active répond en erreur (404, 500…) ou ne répond pas." },
];

export type Metric = "cost" | "conv" | "cpa" | "clicks" | "ctr" | "cpc";
export const METRICS: Record<Metric, { label: string; unit: string }> = {
  cost: { label: "Dépense", unit: "€" },
  conv: { label: "Conversions", unit: "" },
  cpa: { label: "Coût par conversion", unit: "€" },
  clicks: { label: "Clics", unit: "" },
  ctr: { label: "Taux de clic", unit: "%" },
  cpc: { label: "Coût par clic", unit: "€" },
};

export interface CustomRule {
  id: string;
  name: string;
  metric: Metric;
  op: ">" | "<";
  value: number;
  period: "hier" | "7";
  /** vide = compte entier ; sinon campagnes dont le nom contient ce texte */
  campaign: string;
}

export interface AlertsConfig {
  templates: Partial<Record<TemplateKey, { on: boolean; param?: number }>>;
  rules: CustomRule[];
}

const KEY = "alerts_config";

export function defaultConfig(): AlertsConfig {
  return { templates: Object.fromEntries(TEMPLATES.map((t) => [t.key, { on: true, param: t.param?.def }])), rules: [] };
}

export async function getAlertsConfig(): Promise<AlertsConfig> {
  const raw = await getSetting(KEY);
  const def = defaultConfig();
  if (!raw) return def;
  try {
    const c = JSON.parse(raw) as Partial<AlertsConfig>;
    return { templates: { ...def.templates, ...(c.templates ?? {}) }, rules: Array.isArray(c.rules) ? c.rules : [] };
  } catch { return def; }
}

export async function saveAlertsConfig(c: AlertsConfig): Promise<void> {
  await setSetting(KEY, JSON.stringify(c));
}

export function templateOn(c: AlertsConfig, k: TemplateKey) {
  const t = c.templates[k]; const d = TEMPLATES.find((x) => x.key === k)!;
  return { on: t?.on ?? true, param: t?.param ?? d.param?.def ?? 0 };
}
