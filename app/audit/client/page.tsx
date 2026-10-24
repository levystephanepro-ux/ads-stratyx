// Audit client imprimable (PDF) : tiré du dernier diagnostic du compte, rédigé pour le dirigeant.
import { redirect, notFound } from "next/navigation";
import AuditSheet from "@/components/AuditSheet";
import { getDashboardContext } from "@/lib/workspace";
import { latestAuditReports } from "@/lib/audit/run";
import { plainConstat, IMPACT_LABELS, type Impact } from "@/lib/audit/translate";

export const dynamic = "force-dynamic";
type SP = Promise<{ account?: string }>;

const eur = (n: number | string) => `${Math.round(Number(n)).toLocaleString("fr-FR")} €`;
const color = (s: number) => (s >= 80 ? "#0f9d6b" : s >= 60 ? "#d9820b" : "#d92d4b");
const SEV = { critique: "À corriger en priorité", important: "Important", mineur: "À surveiller" } as const;
const SEV_COLOR = { critique: "#d92d4b", important: "#d9820b", mineur: "#6b665e" } as const;
const IMPACT_ORDER: Impact[] = ["appels", "argent", "confiance", "mesure", "visibilite"];

export default async function ClientAudit({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  const reports = await latestAuditReports();
  const r = reports.find((x) => x.customer_id === sp.account) ?? (sp.account ? null : reports[0]);
  if (!r) notFound();
  const plain = r.constats.map(plainConstat);
  const main = plain.filter((c) => c.severity !== "mineur");
  const minor = plain.filter((c) => c.severity === "mineur");
  const groups = IMPACT_ORDER.map((k) => ({ k, items: main.filter((c) => c.impact === k) })).filter((g) => g.items.length);
  const date = new Date(r.created_at ?? r.run_date).toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
  const conv = Math.round(Number(r.conversions));

  return (
    <AuditSheet kicker="Audit de vos publicités Google" title={r.account_name ?? r.customer_id} subtitle={`Compte ${r.customer_id} · analysé le ${date} · 30 derniers jours`} back={{ href: `/waste?account=${r.customer_id}`, label: "Retour au diagnostic" }}>
      <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap", margin: "20px 0" }}>
        <div style={{ width: 110, height: 110, borderRadius: "50%", background: `conic-gradient(${color(r.health_score)} ${r.health_score * 3.6}deg, #eadfce 0deg)`, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", fontSize: 30, fontWeight: 700 }}>{r.health_score}</div>
        </div>
        <div><div className="rv-kicker">Dépensé en 30 jours</div><div style={{ fontSize: 24, fontWeight: 700 }}>{eur(r.total_cost)}</div><div style={{ fontSize: 12 }}>{conv} demande(s) enregistrée(s)</div></div>
        <div><div className="rv-kicker">Dépensé sans aucun résultat</div><div style={{ fontSize: 24, fontWeight: 700, color: "#d92d4b" }}>{eur(r.waste_proven)}</div><div style={{ fontSize: 12 }}>Établi sur des volumes suffisants</div></div>
        <div><div className="rv-kicker">À confirmer</div><div style={{ fontSize: 24, fontWeight: 700, color: "#d9820b" }}>{eur(r.waste_watch)}</div><div style={{ fontSize: 12 }}>Trop tôt pour conclure</div></div>
      </div>
      <p style={{ margin: "0 0 8px" }}>
        Note de santé de votre compte publicitaire sur 100, calculée sur six domaines : recherches, mots-clés, exclusions, budgets, annonces et suivi des demandes.
        {Number(r.waste_proven) > 0 && ` Sur les 30 derniers jours, ${eur(r.waste_proven)} ont été dépensés sur des clics qui n'ont produit aucune demande, alors que le nombre de clics suffisait pour conclure.`}
      </p>

      {main.length > 0 && (
        <section>
          <h2 className="rv-h2">Par où commencer</h2>
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            {main.slice(0, 3).map((c) => <li key={c.id} style={{ margin: "8px 0" }}><strong>{c.title}</strong><div style={{ color: "var(--rv-muted)" }}>{c.action}</div></li>)}
          </ol>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.k}>
          <h2 className="rv-h2">{IMPACT_LABELS[g.k]}</h2>
          {g.items.map((c) => (
            <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--rv-border)", breakInside: "avoid" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <strong>{c.title}</strong>
                <span style={{ fontSize: 12, fontWeight: 600, color: SEV_COLOR[c.severity], whiteSpace: "nowrap" }}>{SEV[c.severity]}{c.amount ? ` · ${eur(c.amount)}` : ""}</span>
              </div>
              <div style={{ fontSize: 13 }}>{c.detail}</div>
              <div style={{ fontSize: 13, color: "var(--rv-accent)" }}>Ce que nous faisons : {c.action}</div>
            </div>
          ))}
        </section>
      ))}
      {minor.length > 0 && <p style={{ marginTop: 24, color: "var(--rv-muted)" }}>{minor.length} point(s) à surveiller, suivis dans notre diagnostic détaillé.</p>}
      {main.length === 0 && <p style={{ marginTop: 24 }}>Aucun point critique ou important détecté sur cette période.</p>}
    </AuditSheet>
  );
}
