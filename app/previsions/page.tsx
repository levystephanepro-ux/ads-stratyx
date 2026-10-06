// Prévisions (façon Forecast d'Ades) : volumes et CPC du planificateur Google,
// estimation clics / leads / coût selon le budget mensuel, rentabilité (panier,
// marge, closing, frais d'agence), puis création d'une campagne Search en pause.
// La simulation est sans IA ; la structure de campagne peut être proposée par l'IA (payant, plafond owner).
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import CampaignBuilder from "@/components/CampaignBuilder";
import { getDashboardContext } from "@/lib/workspace";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { isLive } from "@/lib/google-ads/config";
import { suggestGeo, keywordIdeas, accountCvr, forecast, COUNTRIES, LANGUAGES, type Geo, type Idea, type Forecast } from "@/lib/planner/ideas";
import { createCampaignAction, proposeStructureAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SP = Promise<{
  account?: string; mots?: string; url?: string; lieux?: string; budget?: string; k?: string | string[];
  pays?: string; langue?: string; objectif?: string; panier?: string; marge?: string; closing?: string; frais?: string; scan?: string;
}>;
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const eur2 = (n: number | null) => (n === null ? "–" : `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
const n0 = (n: number) => Math.round(n).toLocaleString("fr-FR");
const n1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");
const COMP: Record<string, string> = { LOW: "faible", MEDIUM: "moyenne", HIGH: "forte" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lab = { display: "block", fontSize: 12, color: "var(--muted)", margin: "0 0 4px" } as const;
const sel = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 14, width: "100%" } as const;
const th = { textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 12 } as const;
const td = { textAlign: "right", padding: "6px 10px", borderBottom: "1px solid var(--border)" } as const;
const KEEP = ["pays", "langue", "objectif", "panier", "marge", "closing", "frais"] as const;

export default async function PrevisionsPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  const { accounts, defaultCustomerId } = isLive() ? await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true }) : { accounts: [], defaultCustomerId: null };
  const account = accounts.some((a) => a.customerId === sp.account) ? sp.account! : defaultCustomerId ?? accounts[0]?.customerId ?? "";
  const accName = accounts.find((a) => a.customerId === account)?.name ?? "";

  const numP = (v: string | undefined) => { const t = (v ?? "").replace(/\s/g, "").replace(",", "."); const n = Number(t); return t !== "" && Number.isFinite(n) ? n : null; };
  const scan = sp.scan === "1"; // « Scanner la page » : mots-clés tirés de la page seule
  const seeds = scan ? [] : (sp.mots ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const url = (sp.url ?? "").trim();
  const lieux = (sp.lieux ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const country = COUNTRIES.find((c) => c.id === sp.pays) ?? COUNTRIES[0];
  const lang = LANGUAGES.find((l) => l.id === sp.langue) ?? LANGUAGES[0];
  const monthly = numP(sp.budget) ?? 900;                     // budget MENSUEL
  const daily = Math.round((monthly / 30.4) * 100) / 100;    // équivalent quotidien
  const objectif = sp.objectif === "ventes" ? "ventes" : "leads";
  const panier = numP(sp.panier), marge = numP(sp.marge) ?? 100, closing = numP(sp.closing), frais = numP(sp.frais) ?? 0;
  const picked = sp.k === undefined ? null : new Set((Array.isArray(sp.k) ? sp.k : [sp.k]).filter(Boolean));

  let geos: Geo[] = [], ideas: Idea[] = [], fc: Forecast | null = null, error: string | null = null, selected: Idea[] = [];
  let cvrInfo = "";
  const asked = seeds.length > 0 || !!url;
  if (!isLive()) error = "Mode démo : les prévisions lisent le planificateur d'un vrai compte Google Ads.";
  else if (scan && !url) error = "Donne l'URL de la page à scanner.";
  else if (asked && account) {
    try {
      geos = lieux.length ? await suggestGeo(lieux, country.code) : [{ id: country.id, name: country.label, type: "Country", canonical: country.label }];
      const [idea, cvr] = await Promise.all([keywordIdeas(account, seeds, geos.map((g) => g.id), url || undefined, lang.id), accountCvr(account)]);
      ideas = idea.slice(0, 80);
      const seedSet = new Set(seeds.map((s) => s.toLowerCase()));
      selected = picked ? ideas.filter((i) => picked.has(i.text)) : ideas.filter((i, n) => seedSet.has(i.text.toLowerCase()) || (n < 15 && i.searches >= 10));
      const levels = [...new Set([0.5, 0.75, 1, 1.5, 2].map((x) => Math.round(monthly * x)))].filter((m) => m > 0).map((m) => m / 30.4);
      fc = forecast(selected, levels, cvr.cvr);
      cvrInfo = `${n0(cvr.conv)} conversion(s) pour ${n0(cvr.clicks)} clics sur 90 jours`;
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }

  // Rentabilité : clients = conversions × closing (leads) ; marge = clients × panier × marge %.
  const closingRate = objectif === "ventes" ? 1 : closing !== null ? closing / 100 : null;
  const profit = panier !== null && closingRate !== null
    ? (conv: number, spend: number) => {
        const clients = conv * closingRate;
        const gross = clients * panier * (marge / 100);
        const net = gross - spend - frais;
        return { clients, gross, net, roi: spend + frais > 0 ? net / (spend + frais) : null };
      }
    : null;
  const breakEven = panier !== null && closingRate !== null ? panier * (marge / 100) * closingRate : null;
  const mine = fc?.rows.find((r) => Math.abs(r.daily * 30.4 - monthly) < 1) ?? null;

  const geoLabel = (g: Geo) => `${g.name}${g.type ? ` (${g.type.toLowerCase().replace("_", " ")})` : ""}`;
  const firstKw = selected.slice(0, 4).map((i) => cap(i.text)).filter((t) => t.length <= 30);
  const initial = {
    name: `Search · ${cap(seeds[0] ?? selected[0]?.text ?? "nouvelle campagne")}${lieux[0] ? ` · ${lieux[0]}` : ""}`.slice(0, 120),
    budget: String(daily), url,
    group: {
      name: "Groupe 1",
      keywords: selected.map((i) => i.text),
      headlines: [...firstKw, ...(lieux[0] && `Artisan à ${lieux[0]}`.length <= 30 ? [`Artisan à ${lieux[0]}`] : []), "Devis gratuit sous 48 h", "Contactez-nous"],
      descriptions: ["À REMPLACER : ce que vous faites, pour qui, et ce qui vous distingue.", "À REMPLACER : l'appel à l'action (devis gratuit, appel, visite)."],
    },
  };
  const selSet = new Set(selected.map((i) => i.text));
  const aiInput = {
    url, objectif: objectif as "leads" | "ventes", country: country.label, language: lang.label,
    places: lieux.length ? geos.map((g) => g.name) : [], monthlyBudget: monthly,
    panier, marge, closing,
    ideas: ideas.map((i) => ({ text: i.text, searches: i.searches, cpcLow: i.low, cpcHigh: i.high, selected: selSet.has(i.text) })),
  };
  const convLabel = objectif === "ventes" ? "Ventes" : "Leads";

  return (
    <Shell active="previsions" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <h1 style={{ margin: "0 0 4px" }}>Prévisions</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Simuler avant de dépenser : recherches, clics, coût et rentabilité de la campagne, puis structure proposée par l&apos;IA et création en pause.
      </p>

      <form method="get" className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
          <div style={{ gridColumn: "span 2" }}><span style={lab}>URL de la page</span><input name="url" defaultValue={url} placeholder="https://www.votresite.com/offre" /></div>
          <div><span style={lab}>Budget mensuel (€)</span><input name="budget" inputMode="decimal" defaultValue={String(monthly)} /></div>
          <div><span style={lab}>Pays</span>
            <select name="pays" defaultValue={country.id} style={sel}>{COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
          <div><span style={lab}>Langue</span>
            <select name="langue" defaultValue={lang.id} style={sel}>{LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></div>
          <div><span style={lab}>Objectif</span>
            <select name="objectif" defaultValue={objectif} style={sel}><option value="leads">Leads (formulaires, RDV)</option><option value="ventes">Ventes en ligne</option></select></div>
          <div><span style={lab}>Panier moyen (€)</span><input name="panier" inputMode="decimal" defaultValue={sp.panier ?? ""} placeholder="ex. 8000" /></div>
          <div><span style={lab}>Marge (%)</span><input name="marge" inputMode="decimal" defaultValue={String(marge)} /></div>
          <div><span style={lab}>Leads qui deviennent clients (%)</span><input name="closing" inputMode="decimal" defaultValue={sp.closing ?? ""} placeholder="ex. 20 (sans objet en ventes)" /></div>
          <div><span style={lab}>Frais d&apos;agence par mois (€)</span><input name="frais" inputMode="decimal" defaultValue={String(frais)} /></div>
          <div><span style={lab}>Villes ou départements (facultatif)</span><input name="lieux" defaultValue={sp.lieux ?? ""} placeholder="Toulon, Hyères, Var" /></div>
          {accounts.length > 1 && (
            <div><span style={lab}>Compte (pour le planificateur)</span>
              <select name="account" defaultValue={account} style={sel}>
                {accounts.map((a) => <option key={a.customerId} value={a.customerId}>{a.name}</option>)}
              </select></div>
          )}
          <div style={{ gridColumn: "1 / -1" }}><span style={lab}>Mots-clés de départ (facultatif si une URL est donnée)</span>
            <input name="mots" defaultValue={sp.mots ?? ""} placeholder="pergola bioclimatique, veranda alu" /></div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
          <button type="submit" name="scan" value="1" className="btn-ghost">Scanner la page</button>
          <button type="submit">Simuler ma campagne</button>
        </div>
      </form>

      {error && <div className="card" style={{ borderColor: "var(--red)", marginBottom: 14 }}>{error}</div>}

      {fc && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <strong>Estimation pour {selected.length} mot(s)-clé(s) · {lieux.length ? geos.map((g) => g.name).join(", ") || "aucun lieu trouvé" : country.label} · {lang.label}</strong>
            <p className="subtitle" style={{ margin: "4px 0 10px", fontSize: 13 }}>
              {n0(fc.searches)} recherches par mois · coût par clic estimé {eur2(fc.cpc)} · au plus {n0(fc.maxClicks)} clics par mois ({Math.round(fc.ctr * 100)} % des recherches), soit {eur(fc.maxSpend)} de dépense utile maximum.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead><tr>{["Budget / mois", "Dépense utile", "Clics", convLabel, objectif === "ventes" ? "Coût / vente" : "Coût / lead", ...(profit ? ["Clients", "Marge dégagée", "Résultat net", "ROI"] : [])].map((h, i) => <th key={h} style={{ ...th, textAlign: i ? "right" : "left" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {fc.rows.map((r) => {
                    const p = profit ? profit(r.conv, r.spend) : null;
                    return (
                      <tr key={r.daily} style={{ fontWeight: r === mine ? 700 : 400 }}>
                        <td style={{ ...td, textAlign: "left" }}>{eur(r.daily * 30.4)}{r.capped ? <span className="subtitle" style={{ fontSize: 11, fontWeight: 400 }}> · plafonné par le volume</span> : null}</td>
                        <td style={td}>{eur(r.spend)}</td><td style={td}>{n0(r.clicks)}</td><td style={td}>{n1(r.conv)}</td><td style={td}>{r.cpa ? eur(r.cpa) : "–"}</td>
                        {p && <>
                          <td style={td}>{n1(p.clients)}</td>
                          <td style={td}>{eur(p.gross)}</td>
                          <td style={{ ...td, color: p.net >= 0 ? "var(--green)" : "var(--red)" }}>{p.net >= 0 ? "+" : "−"}{eur(Math.abs(p.net))}</td>
                          <td style={td}>{p.roi === null ? "–" : `${Math.round(p.roi * 100)} %`}</td>
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {breakEven !== null ? (
              <p style={{ margin: "10px 0 0", fontSize: 14 }}>
                Seuil de rentabilité : un {objectif === "ventes" ? "coût par vente" : "coût par lead"} jusqu&apos;à <strong>{eur(breakEven)}</strong> reste rentable
                {mine?.cpa ? <> ; l&apos;estimation à {eur(monthly)} par mois donne <strong style={{ color: mine.cpa <= breakEven ? "var(--green)" : "var(--red)" }}>{eur(mine.cpa)}</strong>.</> : "."}
                {frais > 0 ? ` Les ${eur(frais)} de frais d'agence sont déduits du résultat net.` : ""}
              </p>
            ) : (
              <p className="subtitle" style={{ margin: "8px 0 0", fontSize: 12 }}>Renseigne le panier moyen{objectif === "leads" ? " et le % de leads qui deviennent clients" : ""} pour voir la rentabilité.</p>
            )}
            <p className="subtitle" style={{ margin: "8px 0 0", fontSize: 12 }}>
              Hypothèses : coût par clic = milieu de la fourchette « haut de page » de Google ; taux de clic {Math.round(fc.ctr * 100)} % ; taux de conversion {n1(fc.cvr * 100)} % ({fc.cvrSource}{cvrInfo ? `, ${cvrInfo}` : ""}). Une estimation pour décider d&apos;un budget, pas une promesse.
            </p>
          </div>

          <form method="get" className="card" style={{ marginBottom: 14 }}>
            <input type="hidden" name="mots" value={sp.mots ?? ""} />
            <input type="hidden" name="url" value={url} />
            <input type="hidden" name="lieux" value={sp.lieux ?? ""} />
            <input type="hidden" name="budget" value={String(monthly)} />
            <input type="hidden" name="account" value={account} />
            {KEEP.map((k) => (sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]} /> : null))}
            {scan && <input type="hidden" name="scan" value="1" />}
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

          <CampaignBuilder customerId={account} accountName={accName} languageId={lang.id}
            geos={geos.map((g) => ({ id: g.id, label: geoLabel(g) }))} initial={initial} aiInput={aiInput}
            propose={proposeStructureAction} create={createCampaignAction} />
          <p className="subtitle" style={{ fontSize: 12, marginTop: 8 }}>Après création : ajoute les extensions (appel, liens, accroches), tes négatifs habituels et les horaires dans Google Ads avant d&apos;activer. <Link href="/waste/journal">Journal des corrections</Link></p>
        </>
      )}
    </Shell>
  );
}
