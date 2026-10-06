// Prévisions : idées de mots-clés et volumes (planificateur Google Ads),
// estimation clics / coût / conversions selon le budget, puis création d'une
// campagne Search en pause. Sans IA.
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import CampaignForm from "@/components/CampaignForm";
import { getDashboardContext } from "@/lib/workspace";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { isLive } from "@/lib/google-ads/config";
import { suggestGeo, keywordIdeas, accountCvr, forecast, type Geo, type Idea, type Forecast } from "@/lib/planner/ideas";
import { createCampaignAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SP = Promise<{ account?: string; mots?: string; url?: string; lieux?: string; budget?: string; k?: string | string[] }>;
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const eur2 = (n: number | null) => (n === null ? "–" : `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const n0 = (n: number) => Math.round(n).toLocaleString("fr-FR");
const n1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");
const COMP: Record<string, string> = { LOW: "faible", MEDIUM: "moyenne", HIGH: "forte" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lab = { display: "block", fontSize: 12, color: "var(--muted)", margin: "0 0 4px" } as const;
const ta = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 14, fontFamily: "inherit", resize: "vertical" } as const;
const th = { textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 12 } as const;
const td = { textAlign: "right", padding: "6px 10px", borderBottom: "1px solid var(--border)" } as const;

export default async function PrevisionsPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  const { accounts, defaultCustomerId } = isLive() ? await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true }) : { accounts: [], defaultCustomerId: null };
  const account = accounts.some((a) => a.customerId === sp.account) ? sp.account! : defaultCustomerId ?? accounts[0]?.customerId ?? "";
  const accName = accounts.find((a) => a.customerId === account)?.name ?? "";
  const seeds = (sp.mots ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const url = (sp.url ?? "").trim();
  const lieux = (sp.lieux ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const budget = Number((sp.budget ?? "").replace(",", ".")) || 30;
  const picked = sp.k === undefined ? null : new Set((Array.isArray(sp.k) ? sp.k : [sp.k]).filter(Boolean));

  let geos: Geo[] = [], ideas: Idea[] = [], fc: Forecast | null = null, error: string | null = null, selected: Idea[] = [];
  let cvrInfo = "";
  const asked = seeds.length > 0 || !!url;
  if (!isLive()) error = "Mode démo : les prévisions lisent le planificateur d'un vrai compte Google Ads.";
  else if (asked && account) {
    try {
      geos = await suggestGeo(lieux.length ? lieux : ["France"]);
      const geoIds = geos.filter((g) => lieux.length ? true : g.id === "2250").map((g) => g.id);
      const [idea, cvr] = await Promise.all([keywordIdeas(account, seeds, geoIds, url || undefined), accountCvr(account)]);
      ideas = idea.slice(0, 80);
      const seedSet = new Set(seeds.map((s) => s.toLowerCase()));
      selected = picked ? ideas.filter((i) => picked.has(i.text)) : ideas.filter((i, n) => seedSet.has(i.text.toLowerCase()) || (n < 15 && i.searches >= 10));
      const levels = [...new Set([10, 20, 30, 50, 80, Math.round(budget)])].sort((a, b) => a - b);
      fc = forecast(selected, levels, cvr.cvr);
      cvrInfo = `${n0(cvr.conv)} conversion(s) pour ${n0(cvr.clicks)} clics sur 90 jours`;
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }

  const geoLabel = (g: Geo) => `${g.name}${g.type ? ` (${g.type.toLowerCase().replace("_", " ")})` : ""}`;
  const firstKw = selected.slice(0, 4).map((i) => cap(i.text)).filter((t) => t.length <= 30);
  const initial: Record<string, string> = {
    customer_id: account, account_name: accName,
    name: `Search · ${cap(seeds[0] ?? "nouvelle campagne")}${lieux[0] ? ` · ${lieux[0]}` : ""}`.slice(0, 120),
    budget: String(budget), keywords: selected.map((i) => i.text).join("\n"), match: "PHRASE", url,
    headlines: [...firstKw, ...(lieux[0] && `Artisan à ${lieux[0]}`.length <= 30 ? [`Artisan à ${lieux[0]}`] : []), "Devis gratuit sous 48 h", "Contactez-nous"].join("\n"),
    descriptions: "À REMPLACER : ce que vous faites, pour qui, et ce qui vous distingue.\nÀ REMPLACER : l'appel à l'action (devis gratuit, appel, visite).",
  };

  return (
    <Shell active="previsions" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <h1 style={{ margin: "0 0 4px" }}>Prévisions</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Avant de lancer une campagne : volumes de recherche, coût par clic, estimation selon le budget, puis création de la campagne en pause. Sans IA, aucun crédit.
      </p>

      <form method="get" className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}><span style={lab}>Mots-clés de départ (un par ligne ou séparés par des virgules)</span>
            <textarea name="mots" rows={3} defaultValue={sp.mots ?? ""} placeholder={"pergola bioclimatique\nveranda alu"} style={ta} /></div>
          <div><span style={lab}>Page du site (facultatif)</span><input name="url" defaultValue={url} placeholder="https://…" /></div>
          <div><span style={lab}>Villes ou départements (virgules)</span><input name="lieux" defaultValue={sp.lieux ?? ""} placeholder="Toulon, Hyères, Var" /></div>
          <div><span style={lab}>Budget visé (€ / jour)</span><input name="budget" inputMode="decimal" defaultValue={String(budget)} /></div>
          {accounts.length > 1 && (
            <div><span style={lab}>Compte</span>
              <select name="account" defaultValue={account} style={{ ...ta, padding: "10px 12px" }}>
                {accounts.map((a) => <option key={a.customerId} value={a.customerId}>{a.name}</option>)}
              </select></div>
          )}
        </div>
        <button type="submit" style={{ marginTop: 12 }}>Lancer la prévision</button>
      </form>

      {error && <div className="card" style={{ borderColor: "var(--red)", marginBottom: 14 }}>{error}</div>}

      {fc && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <strong>Estimation pour {selected.length} mot(s)-clé(s) sélectionné(s)</strong>
            <p className="subtitle" style={{ margin: "4px 0 10px", fontSize: 13 }}>
              {n0(fc.searches)} recherches par mois · coût par clic estimé {eur2(fc.cpc)} · au plus {n0(fc.maxClicks)} clics par mois ({Math.round(fc.ctr * 100)} % des recherches), soit {eur(fc.maxSpend)} de dépense utile maximum.
              {lieux.length ? ` Lieux : ${geos.map((g) => g.name).join(", ") || "aucun trouvé"}.` : " Lieu : France entière."}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead><tr>{["Budget / jour", "Dépense / mois", "Clics / mois", "Conversions / mois", "Coût / conversion"].map((h, i) => <th key={h} style={{ ...th, textAlign: i ? "right" : "left" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {fc.rows.map((r) => (
                    <tr key={r.daily} style={{ fontWeight: r.daily === Math.round(budget) ? 700 : 400 }}>
                      <td style={{ ...td, textAlign: "left" }}>{eur(r.daily)}{r.capped ? <span className="subtitle" style={{ fontSize: 11, fontWeight: 400 }}> · plafonné par le volume</span> : null}</td>
                      <td style={td}>{eur(r.spend)}</td><td style={td}>{n0(r.clicks)}</td><td style={td}>{n1(r.conv)}</td><td style={td}>{r.cpa ? eur(r.cpa) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="subtitle" style={{ margin: "8px 0 0", fontSize: 12 }}>
              Hypothèses : coût par clic = milieu de la fourchette « haut de page » de Google ; taux de clic {Math.round(fc.ctr * 100)} % ; taux de conversion {n1(fc.cvr * 100)} % ({fc.cvrSource}{cvrInfo ? `, ${cvrInfo}` : ""}). Une estimation pour décider d&apos;un budget, pas une promesse.
            </p>
          </div>

          <form method="get" className="card" style={{ marginBottom: 14 }}>
            <input type="hidden" name="mots" value={sp.mots ?? ""} />
            <input type="hidden" name="url" value={url} />
            <input type="hidden" name="lieux" value={sp.lieux ?? ""} />
            <input type="hidden" name="budget" value={String(budget)} />
            <input type="hidden" name="account" value={account} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <strong>Idées de mots-clés ({ideas.length})</strong>
              <button type="submit" className="btn-ghost" style={{ padding: "7px 12px", fontSize: 13 }}>Recalculer avec la sélection</button>
            </div>
            <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto", marginTop: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr>{["", "Mot-clé", "Recherches / mois", "Concurrence", "CPC haut de page"].map((h, i) => <th key={i} style={{ ...th, textAlign: i < 2 ? "left" : "right", position: "sticky", top: 0, background: "var(--surface)" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {ideas.map((i) => (
                    <tr key={i.text}>
                      <td style={{ ...td, textAlign: "left", width: 28 }}><input type="checkbox" name="k" value={i.text} defaultChecked={selected.includes(i)} /></td>
                      <td style={{ ...td, textAlign: "left" }}>{i.text}</td>
                      <td style={td}>{n0(i.searches)}</td>
                      <td style={td}>{COMP[i.competition] ?? "–"}</td>
                      <td style={td}>{i.low !== null || i.high !== null ? `${eur2(i.low)} à ${eur2(i.high)}` : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>

          <CampaignForm action={createCampaignAction} initial={initial} geos={(lieux.length ? geos : geos.filter((g) => g.id === "2250")).map((g) => ({ id: g.id, label: geoLabel(g) }))} />
          <p className="subtitle" style={{ fontSize: 12, marginTop: 8 }}>Après création : ajoute les extensions (appel, liens, accroches), tes négatifs habituels et les horaires dans Google Ads avant d&apos;activer. <Link href="/waste/journal">Journal des corrections</Link></p>
        </>
      )}
    </Shell>
  );
}
