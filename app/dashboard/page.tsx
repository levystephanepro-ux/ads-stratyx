// Accueil façon Ades : bienvenue, tableau de bord (période vs précédente,
// part d'impressions, budget du mois), accès rapides.
import Link from "next/link";
import { getDashboardContext } from "@/lib/workspace";
import { requireSub } from "@/lib/subscription";
import Shell from "@/components/Shell";
import UsageWidget from "@/components/UsageWidget";
import { getDefaultAccountInfo, getAccountsInfo } from "@/lib/google-ads/default-account";
import { isLive } from "@/lib/google-ads/config";
import { buildDashboard, type Dashboard as DashData } from "@/lib/dashboard";
import DashboardPerf, { DASH_PERIODS } from "@/components/DashboardPerf";

export const dynamic = "force-dynamic";

const AUDIT_PROMPT =
  "Fais un audit express de mon compte : les 3 problèmes les plus urgents à traiter cette semaine, avec l'impact estimé.";

export const maxDuration = 60;

type SP = Promise<{ account?: string; p?: string }>;

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const ctx = await getDashboardContext();
  requireSub(ctx);
  const sp = await searchParams;
  const q = `?token=${encodeURIComponent(ctx.mcpToken)}`;

  const accountInfo = await getDefaultAccountInfo({ workspaceId: ctx.workspaceId, isOwner: ctx.isOwner });

  // Tableau de bord : owner en mode live (lecture avec le compte administrateur)
  const period = DASH_PERIODS.some((x) => x.key === sp.p) ? sp.p! : "30";
  let perf: { d: DashData; account: string; accounts: { customerId: string; name: string }[] } | null = null;
  let perfError: string | null = null;
  if (ctx.isOwner && isLive()) {
    try {
      const { accounts, defaultCustomerId } = await getAccountsInfo({ workspaceId: ctx.workspaceId, isOwner: true });
      const account = accounts.some((a) => a.customerId === sp.account) ? sp.account! : defaultCustomerId ?? accounts[0]?.customerId;
      if (account) perf = { d: await buildDashboard({ customerId: account }, period), account, accounts };
    } catch (e) { perfError = e instanceof Error ? e.message : String(e); }
  }

  const headerRight = (
    <span className={`pill ${ctx.mode === "live" ? "ok" : "warn"}`}>
      {ctx.mode === "live" ? "● Live" : "Mode démo"}
    </span>
  );

  return (
    <Shell active="home" token={ctx.mcpToken} headerRight={headerRight} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner} accountName={ctx.defaultAccountName}>
      {/* Hero de bienvenue */}
      <div className="hero" style={{ marginBottom: 18 }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
            <div className="pill ok">
              {ctx.mode === "live" ? "● Connecté · données réelles" : "Mode démo"}
            </div>
            {accountInfo && (
              <div className="pill" style={{ fontSize: 13 }}>
                🏢 {accountInfo.name}
              </div>
            )}
          </div>
          <h1 style={{ fontSize: 32, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            Ravi de te revoir. 👋
          </h1>
          <p className="subtitle" style={{ margin: "0 0 20px", fontSize: 15, maxWidth: 560 }}>
            Tes comptes relus chaque matin : le diagnostic dit par où commencer,
            les scripts donnent les chiffres, le copilote répond à tes questions.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" href={`/copilote${q}&q=${encodeURIComponent(AUDIT_PROMPT)}`}>
              Lancer un audit avec Stratyx →
            </Link>
            <Link className="btn btn-ghost" href="/waste">
              Ouvrir le diagnostic
            </Link>
          </div>
        </div>
      </div>

      {perf && <DashboardPerf d={perf.d} account={perf.account} accounts={perf.accounts} period={period} />}
      {perfError && <div className="card" style={{ marginBottom: 18, borderColor: "var(--red)", fontSize: 13 }}>Tableau de bord indisponible : {perfError.slice(0, 200)}</div>}

      {/* Accès rapides */}
      <div className="tpl-grid" style={{ marginBottom: 26 }}>
        <Link
          href={`/copilote${q}`}
          className="card interactive tpl-card"
          style={{
            color: "inherit",
            background:
              "linear-gradient(150deg, color-mix(in srgb, var(--accent) 20%, var(--surface)), var(--surface))",
          }}
        >
          <div className="tpl-head">
            <div className="tpl-ic">💬</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Copilote</div>
              <div className="subtitle" style={{ fontSize: 13 }}>
                Une question, une réponse lue dans tes données.
              </div>
            </div>
          </div>
        </Link>
        <Link
          href="/waste"
          className="card interactive tpl-card"
          style={{
            color: "inherit",
            background:
              "linear-gradient(150deg, color-mix(in srgb, var(--green) 16%, var(--surface)), var(--surface))",
          }}
        >
          <div className="tpl-head">
            <div className="tpl-ic">🩺</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Diagnostic</div>
              <div className="subtitle" style={{ fontSize: 13 }}>
                Santé /100 et par où commencer, chaque matin.
              </div>
            </div>
          </div>
        </Link>
        <Link
          href="/scripts"
          className="card interactive tpl-card"
          style={{ color: "inherit" }}
        >
          <div className="tpl-head">
            <div className="tpl-ic">📑</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Scripts</div>
              <div className="subtitle" style={{ fontSize: 13 }}>
                98 rapports chiffrés, sans crédit IA.
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Usage API */}
      <UsageWidget />

    </Shell>
  );
}
