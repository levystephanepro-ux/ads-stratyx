// Audit d'une entreprise (prospect) : page de destination, fiche Google Business et potentiel de
// recherche, sans accès à son compte. Livrable imprimable en PDF, rédigé pour le dirigeant.
import Link from "next/link";
import { redirect } from "next/navigation";
import AuditSheet from "@/components/AuditSheet";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { isLive } from "@/lib/google-ads/config";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { analyzeSite } from "@/lib/audit/site";
import { plainSiteCheck, scoreOf, IMPACT_LABELS, type Impact, type PlainCheck } from "@/lib/audit/translate";
import { lookupPlace, placeById, gbpFromManual, gbpChecks, demoGbp, hasPlacesKey, type GbpData } from "@/lib/audit/places";
import PlaceAutocomplete from "@/components/PlaceAutocomplete";
import { suggestGeo, keywordIdeas, forecast, COUNTRIES, type Idea, type Geo } from "@/lib/planner/ideas";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
type SP = Promise<{
  url?: string; lieux?: string; mots?: string; budget?: string; nom?: string;
  fiche?: string; place_id?: string; gb_note?: string; gb_avis?: string; gb_horaires?: string; gb_photos?: string; gb_tel?: string; gb_site?: string;
}>;

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const eur2 = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const color = (s: number) => (s >= 80 ? "#0f9d6b" : s >= 60 ? "#d9820b" : "#d92d4b");
const input = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%" } as const;
const th = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--rv-border)", fontSize: 12 } as const;
const td = { padding: "5px 8px", borderBottom: "1px solid var(--rv-border)" } as const;
const LEVEL = { critique: "À corriger en priorité", important: "Important", mineur: "À surveiller" } as const;
const LEVEL_COLOR = { critique: "#d92d4b", important: "#d9820b", mineur: "#6b665e" } as const;
const ORDER = { critique: 0, important: 1, mineur: 2 } as const;
const SOURCE = { places: "Données lues sur Google", manuel: "Données saisies à la main", exemple: "Données d'exemple (mode démo)" } as const;

function CheckList({ items }: { items: PlainCheck[] }) {
  return (
    <>
      {items.map((c) => (
        <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--rv-border)", breakInside: "avoid" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <strong>{c.label}</strong>
            <span style={{ fontSize: 12, fontWeight: 600, color: LEVEL_COLOR[c.level], whiteSpace: "nowrap" }}>{LEVEL[c.level]}</span>
          </div>
          <div style={{ fontSize: 13 }}>{c.text}</div>
        </div>
      ))}
    </>
  );
}

function Figure({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 160 }}>
      <div className="rv-kicker">{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: tone }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--rv-muted)" }}>{sub}</div>}
    </div>
  );
}

export default async function ProspectAudit({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  const url = (sp.url ?? "").trim();

  if (!url) {
    return (
      <Shell active="audit" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}
        headerRight={<Link className="btn-ghost" href="/clients">Clients</Link>}>
        <h1 style={{ margin: "0 0 6px" }}>Audit entreprise</h1>
        <p className="subtitle" style={{ marginTop: 0 }}>Analyse la page et la fiche Google d&apos;une entreprise, estime son potentiel Google Ads, sans accès à son compte. Résultat imprimable en PDF, rédigé pour le dirigeant.</p>
        <p className="subtitle" style={{ marginTop: 0, fontSize: 13 }}>Besoin de cerner la cible avant l&apos;audit ? <Link href="/persona">Créer un persona →</Link></p>
        <form className="card" style={{ display: "grid", gap: 10, maxWidth: 560, marginTop: 16 }} method="get">
          <input name="nom" placeholder="Nom de l'entreprise" style={input} />
          <input name="url" placeholder="Adresse de sa page ou de son site (https://…)" required style={input} />
          <input name="lieux" placeholder="Villes ou zones visées (séparées par des virgules)" style={input} />
          <textarea name="mots" rows={3} placeholder="Mots-clés de départ, un par ligne (facultatif : sinon lus depuis la page)" style={{ ...input, font: "inherit" }} />
          <input name="budget" placeholder="Budget mensuel envisagé en € (ex. 900)" inputMode="decimal" style={input} />
          <PlaceAutocomplete placeholder={hasPlacesKey() ? "Fiche Google : tapez le nom et la ville, puis choisissez dans la liste" : "Fiche Google : clé Places absente ici, utilisez la saisie manuelle"} />
          <details>
            <summary style={{ cursor: "pointer", fontSize: 13 }}>Saisir la fiche Google à la main (si la recherche automatique ne marche pas)</summary>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <input name="gb_note" placeholder="Note Google (ex. 4,2)" inputMode="decimal" style={input} />
              <input name="gb_avis" placeholder="Nombre d'avis" inputMode="numeric" style={input} />
              <select name="gb_horaires" style={input} defaultValue=""><option value="">Horaires renseignés ? (ne sait pas)</option><option value="oui">Oui</option><option value="non">Non</option></select>
              <input name="gb_photos" placeholder="Nombre de photos sur la fiche" inputMode="numeric" style={input} />
              <input name="gb_tel" placeholder="Téléphone affiché sur la fiche (vide si aucun)" style={input} />
              <input name="gb_site" placeholder="Site affiché sur la fiche (vide si aucun)" style={input} />
            </div>
          </details>
          <button type="submit">Lancer l&apos;audit</button>
        </form>
      </Shell>
    );
  }

  const nom = (sp.nom ?? "").trim() || url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const lieux = (sp.lieux ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const seeds = (sp.mots ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const monthly = Number((sp.budget ?? "").replace(/\s/g, "").replace(",", ".")) || 900;
  const fiche = (sp.fiche ?? "").trim();

  const site = await analyzeSite(url);

  // Fiche Google : lecture automatique, sinon saisie manuelle, sinon exemple (mode démo sans clé).
  let gbp: GbpData | null = null, gbpMessage: string | null = null;
  if (fiche || sp.place_id) {
    // Suggestion choisie dans la liste : fiche exacte. Sinon, recherche par texte (première correspondance).
    const r = sp.place_id ? await placeById(sp.place_id) : await lookupPlace(fiche);
    gbp = r.data; gbpMessage = r.message;
    if (gbp && sp.place_id && !gbp.name) gbp.name = nom;
  }
  if (!gbp) {
    const manual = gbpFromManual(sp, nom);
    if (manual) { gbp = manual; if (fiche) gbpMessage = gbpMessage ? `${gbpMessage} Les valeurs saisies à la main sont utilisées.` : null; }
  }
  if (!gbp && fiche && !isLive() && !hasPlacesKey()) { gbp = demoGbp(nom); gbpMessage = null; }

  let ideas: Idea[] = [], geos: Geo[] = [], kwError: string | null = null;
  let forecastRes: ReturnType<typeof forecast> | null = null;
  if (!isLive()) kwError = "Mode démo : le potentiel de recherche demande un vrai compte Google Ads.";
  else {
    try {
      const { accounts, defaultCustomerId } = await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true });
      const account = defaultCustomerId ?? accounts[0]?.customerId;
      if (!account) throw new Error("Aucun compte Google Ads disponible pour interroger le planificateur.");
      geos = lieux.length ? await suggestGeo(lieux, COUNTRIES[0].code, { best: true }) : [{ id: COUNTRIES[0].id, name: "France", type: "Country", canonical: "France" }];
      ideas = (await keywordIdeas(account, seeds, geos.map((g) => g.id), seeds.length ? undefined : site.finalUrl)).slice(0, 25);
      forecastRes = forecast(ideas.slice(0, 15), [monthly / 30.4], null);
    } catch (e) { kwError = e instanceof Error ? e.message : String(e); }
  }

  const siteChecks = site.error ? [] : site.checks.map(plainSiteCheck);
  // Les contrôles de la fiche sont déjà rédigés pour le dirigeant : on les met seulement au format commun.
  const gbpItems: PlainCheck[] = gbp
    ? gbpChecks(gbp, site.finalUrl).map((c) => ({
        id: c.id, level: c.level, ok: c.ok, label: c.label, text: c.detail,
        impact: (c.id === "gbp-reviews" || c.id === "gbp-rating" ? "confiance" : "appels") as Impact,
      }))
    : [];
  const all = [...siteChecks, ...gbpItems];
  const fails = all.filter((c) => !c.ok).sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  const siteFails = fails.filter((c) => !c.id.startsWith("gbp-"));
  const gbpFails = fails.filter((c) => c.id.startsWith("gbp-"));
  const score = scoreOf(all);
  const critiques = fails.filter((c) => c.level === "critique").length;
  const byImpact = (Object.keys(IMPACT_LABELS) as Impact[]).map((k) => ({ k, n: fails.filter((c) => c.impact === k).length })).filter((g) => g.n);
  const date = new Date().toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
  const row = forecastRes?.rows[0];

  return (
    <AuditSheet kicker="Audit de votre présence en ligne" title={nom} subtitle={`${site.finalUrl} · ${date}`} back={{ href: "/audit/prospect", label: "Nouvel audit" }}>
      {all.length === 0 ? (
        <p style={{ margin: "20px 0", color: "#d92d4b" }}>{site.error ?? "Aucune analyse disponible."}</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", margin: "20px 0" }}>
            <div style={{ width: 110, height: 110, borderRadius: "50%", background: `conic-gradient(${color(score)} ${score * 3.6}deg, #eadfce 0deg)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", fontSize: 30, fontWeight: 700 }}>{score}</div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong>Votre présence en ligne est-elle prête à recevoir des clients venus de la publicité ?</strong>
              <div style={{ color: "var(--rv-muted)" }}>
                {fails.length === 0
                  ? "Aucun point bloquant détecté."
                  : `${fails.length} point(s) à corriger, dont ${critiques} à traiter avant d'engager un budget publicitaire.`}
                {byImpact.length > 0 && ` Ils touchent surtout : ${byImpact.map((g) => `${IMPACT_LABELS[g.k].toLowerCase()} (${g.n})`).join(", ")}.`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid var(--rv-border)", borderBottom: "1px solid var(--rv-border)" }}>
            <Figure label="Budget mensuel envisagé" value={eur(monthly)} sub={critiques > 0 ? `${critiques} point(s) à corriger avant de l'engager` : "Aucun point bloquant avant de l'engager"} />
            <Figure label="Demandes estimées par mois" value={row ? row.conv.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "–"}
              sub={row && forecastRes ? `Estimation : ${forecastRes.cvrSource}` : "Estimation indisponible"} />
            <Figure label="Coût estimé d'une demande" value={row?.cpa ? eur(row.cpa) : "–"} sub={row?.cpa ? "À confirmer avec le suivi réel" : undefined} />
          </div>

          {fails.length > 0 && (
            <section>
              <h2 className="rv-h2">Par où commencer</h2>
              <ol style={{ paddingLeft: 20, margin: 0 }}>
                {fails.slice(0, 3).map((c) => <li key={c.id} style={{ margin: "8px 0" }}><strong>{c.label}</strong><div style={{ color: "var(--rv-muted)" }}>{c.text}</div></li>)}
              </ol>
            </section>
          )}

          <section>
            <h2 className="rv-h2">Votre fiche Google{gbp ? ` · ${gbp.name}` : ""}</h2>
            {gbp ? (
              <>
                <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--rv-muted)" }}>
                  {SOURCE[gbp.source]}{gbp.address ? ` · ${gbp.address}` : ""}{gbp.source === "places" ? " · vérifiez que c'est bien la bonne entreprise" : ""}.
                </p>
                {gbpMessage && <p style={{ color: "#d9820b", fontSize: 13 }}>{gbpMessage}</p>}
                {gbpFails.length > 0 && <CheckList items={gbpFails} />}
                {gbpItems.some((c) => c.ok) && (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>{gbpItems.filter((c) => c.ok).map((c) => <li key={c.id}><strong>{c.label}</strong> : {c.text}</li>)}</ul>
                )}
              </>
            ) : (
              <p style={{ color: "var(--rv-muted)" }}>{gbpMessage ?? "Fiche Google non analysée. Indiquez le nom et la ville de l'entreprise, ou saisissez les valeurs à la main."}</p>
            )}
          </section>

          <section>
            <h2 className="rv-h2">Votre page d&apos;atterrissage</h2>
            {site.error ? <p style={{ color: "#d92d4b" }}>{site.error}</p> : (
              <>
                {siteFails.length > 0 && <CheckList items={siteFails} />}
                <h3 style={{ margin: "16px 0 4px", fontSize: 14 }}>Ce qui est déjà en place</h3>
                <ul style={{ margin: 0, paddingLeft: 20 }}>{siteChecks.filter((c) => c.ok).map((c) => <li key={c.id}><strong>{c.label}</strong> : {c.text}</li>)}</ul>
              </>
            )}
          </section>
        </>
      )}

      <section>
        <h2 className="rv-h2">Ce que vos clients recherchent{geos.length ? ` · ${geos.map((g) => g.name).join(", ")}` : ""}</h2>
        {kwError ? <p style={{ color: "#d92d4b" }}>{kwError}</p> : ideas.length === 0 ? <p>Aucune recherche trouvée pour cette page et cette zone.</p> : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Recherche</th><th style={{ ...th, textAlign: "right" }}>Recherches par mois</th><th style={{ ...th, textAlign: "right" }}>Prix estimé d&apos;un clic</th></tr></thead>
              <tbody>
                {ideas.map((i) => (
                  <tr key={i.text}><td style={td}>{i.text}</td><td style={{ ...td, textAlign: "right" }}>{i.searches.toLocaleString("fr-FR")}</td>
                    <td style={{ ...td, textAlign: "right" }}>{i.low !== null && i.high !== null ? `${eur2(i.low)} à ${eur2(i.high)}` : "–"}</td></tr>
                ))}
              </tbody>
            </table>
            {forecastRes && row && (
              <p style={{ marginTop: 14 }}>
                Avec un budget de <strong>{eur(monthly)}</strong> par mois sur les {Math.min(15, ideas.length)} premières recherches : environ <strong>{Math.round(row.clicks)} visites</strong> par mois
                à {eur2(forecastRes.cpc)} le clic en moyenne, soit environ <strong>{row.conv.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} demandes</strong> si {Math.round(forecastRes.cvr * 100)} % des visiteurs vous contactent (hypothèse, à confirmer avec le suivi réel).
                {row.capped && ` Le nombre de recherches limite la dépense utile à environ ${eur(forecastRes.maxSpend)} par mois : au-delà, l'argent ne trouverait pas de clients supplémentaires.`}
              </p>
            )}
            <p style={{ fontSize: 12, color: "var(--rv-muted)" }}>Volumes et prix : planificateur de mots-clés Google Ads. Ce sont des estimations, pas des garanties.</p>
          </>
        )}
      </section>
    </AuditSheet>
  );
}
