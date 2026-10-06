// Lien public d'un rapport client : pas de connexion, chiffres relus à chaque ouverture.
import { notFound } from "next/navigation";
import ReportView from "@/components/ReportView";
import PrintButton from "@/components/PrintButton";
import { getReportByToken } from "@/lib/reports/store";
import { buildReport } from "@/lib/reports/data";
import { PERIODS, periodRange } from "@/lib/reports/periods";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Rapport de performance Google Ads", robots: { index: false, follow: false } };

type P = Promise<{ token: string }>;
type SP = Promise<{ p?: string }>;

export default async function PublicReport({ params, searchParams }: { params: P; searchParams: SP }) {
  const { token } = await params;
  const sp = await searchParams;
  const r = await getReportByToken(token);
  if (!r) notFound();
  const valid = [...PERIODS.map((p) => p.key), "365"];
  const period = r.client_period && sp.p && valid.includes(sp.p) ? sp.p : r.period;
  const data = await buildReport({ customerId: r.customer_id }, periodRange(period), r.sections);
  const bg = r.theme === "sombre" ? "#0b0b12" : "#f1f0f7";

  return (
    <main style={{ background: bg, minHeight: "100vh", padding: "24px 12px" }}>
      <div className="no-print" style={{ maxWidth: 980, margin: "0 auto 12px", display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        {r.client_period && (
          <form style={{ display: "flex", gap: 6 }}>
            <select name="p" defaultValue={period} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d0cde0", background: "#fff", color: "#14142b" }}>
              {[...PERIODS, { key: "365", label: "12 derniers mois" }].map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <button type="submit" className="btn-ghost" style={{ background: "#fff", color: "#14142b" }}>Afficher</button>
          </form>
        )}
        <PrintButton />
      </div>
      <ReportView data={data} meta={{
        title: r.title || `${r.account_name ?? r.customer_id} · bilan`, accountName: r.account_name ?? r.customer_id, customerId: r.customer_id,
        author: r.author, mode: r.mode, theme: r.theme, compare: r.compare, sections: r.sections,
        intro: r.intro, analysis: r.analysis, optimisations: r.optimisations,
      }} />
    </main>
  );
}
