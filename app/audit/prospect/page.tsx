// Audit prospect : page de destination + potentiel de recherche, sans accès à son compte.
import Link from "next/link";
import { redirect } from "next/navigation";
import AuditSheet from "@/components/AuditSheet";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { isLive } from "@/lib/google-ads/config";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { analyzeSite } from "@/lib/audit/site";
import { suggestGeo, keywordIdeas, forecast, COUNTRIES, type Idea, type Geo } from "@/lib/planner/ideas";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
type SP = Promise<{ url?: string; lieux?: string; mots?: string; budget?: string; nom?: string }>;

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const eur2 = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const color = (s: number) => (s >= 80 ? "#0f9d6b" : s >= 60 ? "#d9820b" : "#d92d4b");
const input = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%" } as const;
const th = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--rv-border)", fontSize: 12 } as const;
const td = { padding: "5px 8px", borderBottom: "1px solid var(--rv-border)" } as const;

export default async function ProspectAudit({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  const url = (sp.url ?? "").trim();

  if (!url) {
    return (
      <Shell active="clients" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}
        headerRight={<Link className="btn-ghost" href="/clients">Clients</Link>}>
        <h1 style={{ margin: "0 0 6px" }}>Audit prospect</h1>
        <p className="subtitle" style={{ marginTop: 0 }}>Analyse la page d&apos;un prospect et estime son potentiel Google Ads, sans accès à son compte. Résultat imprimable en PDF.</p>
        <form className="card" style={{ display: "grid", gap: 10, maxWidth: 560, marginTop: 16 }} method="get">
          <input name="nom" placeholder="Nom du prospect" style={input} />
          <input name="url" placeholder="Adresse de sa page ou de son site (https://…)" required style={input} />
          <input name="lieux" placeholder="Villes ou zones visées (séparées par des virgules)" style={input} />
          <textarea name="mots" rows={3} placeholder="Mots-clés de départ, un par ligne (facultatif : sinon lus depuis la page)" style={{ ...input, font: "inherit" }} />
          <input name="budget" placeholder="Budget mensuel envisagé en € (ex. 900)" inputMode="decimal" style={input} />
          <button type="submit">Lancer l&apos;audit</button>
        </form>
      </Shell>
    );
  }

  const nom = (sp.nom ?? "").trim() || url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const lieux = (sp.lieux ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const seeds = (sp.mots ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const monthly = Number((sp.budget ?? "").replace(/\s/g, "").replace(",", ".")) || 900;

  const site = await analyzeSite(url);
  let ideas: Idea[] = [], geos: Geo[] = [], kwError: string | null = null;
  let forecastRes: ReturnType<typeof forecast> | null = null;
  if (!isLive()) kwError = "Mode démo : le potentiel de recherche demande un vrai compte Google Ads.";
  else {
    try {
      const { accounts, defaultCustomerId } = await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true });
      const account = defaultCustomerId ?? accounts[0]?.customerId;
      if (!account) throw new Error("Aucun compte Google Ads disponible pour interroger le planificateur.");
      geos = lieux.length ? await suggestGeo(lieux, COUNTRIES[0].code) : [{ id: COUNTRIES[0].id, name: "France", type: "Country", canonical: "France" }];
      ideas = (await keywordIdeas(account, seeds, geos.map((g) => g.id), seeds.length ? undefined : site.finalUrl)).slice(0, 25);
      forecastRes = forecast(ideas.slice(0, 15), [monthly / 30.4], null);
    } catch (e) { kwError = e instanceof Error ? e.message : String(e); }
  }
  const fails = site.checks.filter((c) => !c.ok);
  const order = { critique: 0, important: 1, mineur: 2 } as const;
  fails.sort((a, b) => order[a.level] - order[b.level]);
  const date = new Date().toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
  const row = forecastRes?.rows[0];

  return (
    <AuditSheet kicker="Audit de présence Google Ads" title={nom} subtitle={`${site.finalUrl} · ${date}`} back={{ href: "/audit/prospect", label: "Nouvel audit" }}>
      {site.error ? (
        <p style={{ margin: "20px 0", color: "#d92d4b" }}>{site.error}</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", margin: "20px 0" }}>
            <div style={{ width: 110, height: 110, borderRadius: "50%", background: `conic-gradient(${color(site.score)} ${site.score * 3.6}deg, #eadfce 0deg)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", fontSize: 30, fontWeight: 700 }}>{site.score}</div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong>Préparation de la page pour la publicité</strong>
              <div style={{ color: "var(--rv-muted)" }}>{fails.length === 0 ? "Aucun point bloquant détecté." : `${fails.length} point(s) à corriger avant d'envoyer du trafic payant, ${fails.filter((f) => f.level === "critique").length} critique(s).`}</div>
            </div>
          </div>

          {fails.length > 0 && (
            <section>
              <h2 className="rv-h2">À corriger</h2>
              {fails.map((c) => (
                <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--rv-border)", breakInside: "avoid" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>{c.label}</strong>
                    <span style={{ fontSize: 12, fontWeight: 600, color: c.level === "critique" ? "#d92d4b" : c.level === "important" ? "#d9820b" : "#6b665e" }}>{c.level === "critique" ? "Critique" : c.level === "important" ? "Important" : "À surveiller"}</span>
                  </div>
                  <div style={{ fontSize: 13 }}>{c.detail}</div>
                </div>
              ))}
            </section>
          )}
          <section>
            <h2 className="rv-h2">Ce qui est en place</h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{site.checks.filter((c) => c.ok).map((c) => <li key={c.id}><strong>{c.label}</strong> : {c.detail}</li>)}</ul>
          </section>
        </>
      )}

      <section>
        <h2 className="rv-h2">Potentiel de recherche{geos.length ? ` · ${geos.map((g) => g.name).join(", ")}` : ""}</h2>
        {kwError ? <p style={{ color: "#d92d4b" }}>{kwError}</p> : ideas.length === 0 ? <p>Aucun mot-clé trouvé pour cette page et cette zone.</p> : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Recherche</th><th style={{ ...th, textAlign: "right" }}>Volume mensuel</th><th style={{ ...th, textAlign: "right" }}>Coût par clic estimé</th></tr></thead>
              <tbody>
                {ideas.map((i) => (
                  <tr key={i.text}><td style={td}>{i.text}</td><td style={{ ...td, textAlign: "right" }}>{i.searches.toLocaleString("fr-FR")}</td>
                    <td style={{ ...td, textAlign: "right" }}>{i.low !== null && i.high !== null ? `${eur2(i.low)} à ${eur2(i.high)}` : "–"}</td></tr>
                ))}
              </tbody>
            </table>
            {forecastRes && row && (
              <p style={{ marginTop: 14 }}>
                Avec un budget de <strong>{eur(monthly)}</strong> par mois sur les {Math.min(15, ideas.length)} premières recherches : environ <strong>{Math.round(row.clicks)} clics</strong> par mois
                à {eur2(forecastRes.cpc)} de moyenne, soit environ <strong>{row.conv.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} demandes</strong> si {Math.round(forecastRes.cvr * 100)} % des visiteurs convertissent (hypothèse, à confirmer avec le suivi réel).
                {row.capped && ` Le volume de recherche plafonne la dépense à environ ${eur(forecastRes.maxSpend)} par mois.`}
              </p>
            )}
            <p style={{ fontSize: 12, color: "var(--rv-muted)" }}>Volumes et coûts : planificateur de mots clés Google Ads. Ce sont des estimations, pas des garanties.</p>
          </>
        )}
      </section>
    </AuditSheet>
  );
}
