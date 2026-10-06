// Bibliothèque de scripts : rapports chiffrés lus dans Google Ads, sans IA (0 crédit).
import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { SCRIPTS } from "@/lib/scripts/registry";
import { SCRIPT_CATEGORIES, type ScriptCategory } from "@/lib/scripts/types";

export const dynamic = "force-dynamic";

type SP = Promise<{ cat?: string; q?: string }>;

export default async function ScriptsPage({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) redirect("/dashboard");
  const sp = await searchParams;
  const cat = sp.cat && sp.cat in SCRIPT_CATEGORIES ? (sp.cat as ScriptCategory) : null;
  const term = (sp.q ?? "").toLowerCase().trim();

  const counts = new Map<string, number>();
  SCRIPTS.forEach((s) => counts.set(s.category, (counts.get(s.category) ?? 0) + 1));
  const shown = SCRIPTS.filter((s) => (!cat || s.category === cat) &&
    (!term || `${s.title} ${s.description}`.toLowerCase().includes(term)));

  return (
    <Shell active="scripts" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      <h1 style={{ margin: "0 0 6px" }}>Scripts</h1>
      <p className="subtitle" style={{ marginTop: 0 }}>
        {SCRIPTS.length} rapports lus directement dans Google Ads. Sans IA, aucun crédit consommé, rien n&apos;est modifié.
      </p>

      <form style={{ margin: "14px 0 10px" }}>
        {cat && <input type="hidden" name="cat" value={cat} />}
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Chercher un script…"
          style={{ width: "100%", maxWidth: 420, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }} />
      </form>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <Link href="/scripts" className={`pill ${!cat ? "ok" : ""}`}>Tous · {SCRIPTS.length}</Link>
        {(Object.keys(SCRIPT_CATEGORIES) as ScriptCategory[]).filter((k) => counts.get(k)).map((k) => (
          <Link key={k} href={`/scripts?cat=${k}`} className={`pill ${cat === k ? "ok" : ""}`}>
            {SCRIPT_CATEGORIES[k]} · {counts.get(k)}
          </Link>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {shown.map((s) => (
          <Link key={s.id} href={`/scripts/${s.id}`} className="card interactive" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <span className="pill" style={{ fontSize: 11 }}>{SCRIPT_CATEGORIES[s.category]}</span>
              <span className="pill" style={{ fontSize: 11 }}>{s.level}</span>
            </div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.title}</div>
            <div className="subtitle" style={{ margin: 0, fontSize: 13 }}>{s.description}</div>
            <div className="subtitle" style={{ margin: "8px 0 0", fontSize: 12 }}>{s.frequency} · {s.channels}</div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
