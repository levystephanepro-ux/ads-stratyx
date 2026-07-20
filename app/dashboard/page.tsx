// Accueil — façon Ades : bienvenue + accès rapides + templates populaires.
// Volontairement sans "compte" ni "aperçu perf" (déplacés hors de l'accueil).
import Link from "next/link";
import { getDashboardContext } from "@/lib/workspace";
import { requireSub } from "@/lib/subscription";
import { listTemplates } from "@/lib/agent/store";
import Shell from "@/components/Shell";
import UsageWidget from "@/components/UsageWidget";
import { getDefaultAccountInfo } from "@/lib/google-ads/default-account";

export const dynamic = "force-dynamic";

function catHue(cat: string): number {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) & 0xffff;
  return h % 360;
}
function catStyle(cat: string) {
  if (!cat) return {};
  return {
    color: `hsl(${catHue(cat)}, 65%, 68%)`,
    borderColor: `hsla(${catHue(cat)}, 60%, 55%, 0.35)`,
    background: `hsla(${catHue(cat)}, 60%, 55%, 0.12)`,
  };
}

const AUDIT_PROMPT =
  "Fais un audit express de mon compte : les 3 problèmes les plus urgents à traiter cette semaine, avec l'impact estimé.";

export default async function Dashboard() {
  const ctx = await getDashboardContext();
  requireSub(ctx);
  const q = `?token=${encodeURIComponent(ctx.mcpToken)}`;

  const [templates, accountInfo] = await Promise.all([
    listTemplates(),
    getDefaultAccountInfo({ workspaceId: ctx.workspaceId, isOwner: ctx.isOwner }),
  ]);
  const popular = templates.slice(0, 6);

  const headerRight = (
    <span className={`pill ${ctx.mode === "live" ? "ok" : "warn"}`}>
      {ctx.mode === "live" ? "● Live" : "Mode démo"}
    </span>
  );

  return (
    <Shell active="home" token={ctx.mcpToken} headerRight={headerRight} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner}>
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
            Pilote tes Google Ads : discute avec tes campagnes, lance des agents qui
            bossent 24/7, ou pioche un prompt prêt à l'emploi.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" href={`/copilote${q}&q=${encodeURIComponent(AUDIT_PROMPT)}`}>
              Lancer un audit avec Stratyx →
            </Link>
            <Link className="btn btn-ghost" href={`/agent${q}`}>
              Voir mes agents
            </Link>
          </div>
        </div>
      </div>

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
                Analyse, optimise, pilote par conversation.
              </div>
            </div>
          </div>
        </Link>
        <Link
          href={`/templates${q}`}
          className="card interactive tpl-card"
          style={{
            color: "inherit",
            background:
              "linear-gradient(150deg, color-mix(in srgb, var(--green) 16%, var(--surface)), var(--surface))",
          }}
        >
          <div className="tpl-head">
            <div className="tpl-ic">📋</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Templates</div>
              <div className="subtitle" style={{ fontSize: 13 }}>
                40+ prompts prêts à l'emploi, modifiables.
              </div>
            </div>
          </div>
        </Link>
        <Link
          href={`/agent${q}`}
          className="card interactive tpl-card"
          style={{ color: "inherit" }}
        >
          <div className="tpl-head">
            <div className="tpl-ic">🤖</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Agent IA</div>
              <div className="subtitle" style={{ fontSize: 13 }}>
                Des missions qui tournent toutes seules 24/7.
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Usage API */}
      <UsageWidget />

      {/* Templates populaires */}
      {popular.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
            }}
          >
            <div className="section-title" style={{ margin: 0 }}>
              Templates populaires
            </div>
            <Link href={`/templates${q}`} style={{ fontSize: 13 }}>
              Voir tous →
            </Link>
          </div>
          <div className="tpl-grid">
            {popular.map((t) => (
              <Link
                key={t.id}
                href={`/copilote${q}&q=${encodeURIComponent(t.prompt)}`}
                className="card interactive tpl-card"
                style={{ color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{t.name}</div>
                  <span className="pill" style={{ fontSize: 11, padding: "2px 8px", flexShrink: 0, marginTop: 1, ...catStyle(t.category) }}>
                    {t.category}
                  </span>
                </div>
                {t.description && (
                  <div className="subtitle" style={{ fontSize: 12.5, marginBottom: 10 }}>
                    {t.description}
                  </div>
                )}
                <div className="tpl-actions">
                  <span className="subtitle" style={{ fontSize: 13 }}>Ouvrir →</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

    </Shell>
  );
}
