// Bloc "Meta Ads" du rapport du lundi : section markdown ajoutée à l'email existant
// (le convertisseur de lib/agent/email.ts la rend en HTML avec CSS inline).
import { getMetaWeeklyInsights, configuredMetaAccountIds } from "./insights";
import { isLive } from "../google-ads/config";

export interface GoogleTotals { cost: number; conversions: number }

const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
const int = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
const cplText = (cpl: number | null) => (cpl === null ? "-" : eur(cpl));

/**
 * Section markdown "Meta Ads", ou null si Meta n'est pas configuré (rien à afficher).
 * Ne lève jamais : toute erreur devient "Meta indisponible cette semaine".
 */
export async function buildMetaSection(google: GoogleTotals | null): Promise<string | null> {
  try {
    const ids = configuredMetaAccountIds();
    if (isLive() && ids.length === 0) return null;

    const { accounts, failed } = await getMetaWeeklyInsights(ids);
    if (accounts.length === 0) return "# Meta Ads\n\nMeta indisponible cette semaine.";

    const spend = accounts.reduce((s, a) => s + a.spend, 0);
    const leads = accounts.reduce((s, a) => s + a.leads, 0);
    const rows = accounts.map((a) => `| act_${a.accountId} | ${eur(a.spend)} | ${int(a.leads)} | ${cplText(a.cpl)} |`);
    const lines = [
      "# Meta Ads",
      "",
      "| Compte | Dépense | Leads | CPL |",
      "|---|---|---|---|",
      ...rows,
      `| **Total** | **${eur(spend)}** | **${int(leads)}** | **${cplText(leads > 0 ? spend / leads : null)}** |`,
    ];
    if (failed.length) lines.push("", `Compte(s) indisponible(s) cette semaine : ${failed.map((f) => `act_${f}`).join(", ")}.`);

    if (google && google.conversions > 0 && leads > 0) {
      const global = (google.cost + spend) / (google.conversions + leads);
      lines.push("", `**CPL global Google + Meta : ${eur(global)}** (${eur(google.cost + spend)} pour ${int(google.conversions + leads)} leads)`);
    }
    return lines.join("\n");
  } catch (e) {
    console.error(`[meta] bloc rapport en échec : ${e instanceof Error ? e.message : "erreur inconnue"}`);
    return "# Meta Ads\n\nMeta indisponible cette semaine.";
  }
}
