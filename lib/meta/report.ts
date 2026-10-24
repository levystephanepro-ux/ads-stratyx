// Section « Meta Ads » du rapport du lundi, en markdown. Le convertisseur de lib/agent/email.ts
// en fait un tableau HTML aux styles inline, comme le reste du mail : aucun template ici.
import type { MetaInsightsResult } from "./parse.ts";

/** Dépense et conversions Google de la semaine, tous comptes du rapport confondus. */
export type GoogleTotals = { cost: number; conversions: number };

const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const count = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
// Un nom de compte ne doit casser ni le tableau (|) ni la mise en forme (* et `).
const cell = (s: string) => s.replace(/[|*`]/g, " ").replace(/\s+/g, " ").trim();

export const META_UNAVAILABLE = "Meta indisponible cette semaine";

/** Vrai s'il y a au moins un compte à afficher (sinon le rapport ne vaut pas un envoi à lui seul). */
export function metaHasData(meta: MetaInsightsResult | null): boolean {
  return !!meta && meta.accounts.length > 0;
}

export function buildMetaSection(meta: MetaInsightsResult | null, google: GoogleTotals | null): string {
  if (!meta || !metaHasData(meta)) return `# Meta Ads\n\n${META_UNAVAILABLE}`;

  const spend = meta.accounts.reduce((s, a) => s + a.spend, 0);
  const leads = meta.accounts.reduce((s, a) => s + a.leads, 0);
  const rows = meta.accounts.map((a) =>
    `| ${cell(a.accountName ?? `act_${a.accountId}`)} | ${eur(a.spend)} | ${count(a.leads)} | ${a.cpl === null ? "-" : eur(a.cpl)} |`);
  rows.push(`| **Total Meta** | **${eur(spend)}** | **${count(leads)}** | **${leads > 0 ? eur(spend / leads) : "-"}** |`);

  // CPL global : seulement si Google ET Meta ont des leads, sinon le chiffre n'a pas de sens.
  if (google && google.conversions > 0 && leads > 0) {
    const totalSpend = google.cost + spend;
    const totalLeads = google.conversions + leads;
    rows.push(`| **CPL global Google + Meta** | **${eur(totalSpend)}** | **${count(totalLeads)}** | **${eur(totalSpend / totalLeads)}** |`);
  }

  const out = ["# Meta Ads", "", "| Compte | Dépense | Leads | CPL |", "|---|---|---|---|", ...rows];
  if (meta.failed.length) {
    out.push("", `Comptes non lus cette semaine : ${cell(meta.failed.join(", "))}. Les totaux ci-dessus sont incomplets.`);
  }
  return out.join("\n");
}
