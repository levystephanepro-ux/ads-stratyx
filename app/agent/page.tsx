// Page Agent IA — liste des agents (depuis la base), création/édition/exécution.
import { listTasks, listTemplates, supabaseReady } from "@/lib/agent/store";
import AgentTasksManager from "@/components/AgentTasksManager";
import Shell from "@/components/Shell";
import { getAccountsInfo } from "@/lib/google-ads/default-account";
import { getDashboardContext } from "@/lib/workspace";
import { requireSub } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  // Accès protégé par le middleware (session Supabase).
  const ctx = await getDashboardContext();
  requireSub(ctx);

  const tok = ctx.mcpToken;
  const anthropicMissing = !process.env.ANTHROPIC_API_KEY;
  const dbReady = supabaseReady();
  const [tasks, templates, { accounts, defaultCustomerId }] = await Promise.all([
    listTasks(),
    listTemplates(),
    getAccountsInfo(),
  ]);
  const templateCategories = [...new Set(templates.map((t) => t.category).filter(Boolean))].sort();

  return (
    <Shell active="agent" token={tok} trialDaysLeft={ctx.trialDaysLeft}>
      <h1 className="page-title">🤖 Agent IA</h1>
      <p className="page-lede">
        Des agents qui exécutent des missions récurrentes tout seuls et t'envoient
        le rapport par email. Crée les tiens, ou lance-les à la main.
      </p>

      {anthropicMissing && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            borderColor: "color-mix(in srgb, #fbbf24 40%, transparent)",
          }}
        >
          <strong>Clé API Anthropic manquante.</strong>
          <p className="subtitle" style={{ marginTop: 6, marginBottom: 0 }}>
            Ajoute <span className="mono" style={{ display: "inline", padding: "1px 6px" }}>ANTHROPIC_API_KEY</span>{" "}
            dans Vercel pour activer les agents.
          </p>
        </div>
      )}

      <AgentTasksManager
        tasks={tasks}
        token={tok}
        dbReady={dbReady}
        accounts={accounts}
        defaultCustomerId={defaultCustomerId}
        templateCategories={templateCategories}
      />

      <p className="subtitle" style={{ fontSize: 13, marginTop: 24 }}>
        Les agents « Programmé » tournent automatiquement (cron quotidien) et
        t'envoient le rapport par email — sans que tu aies à ouvrir cette page.
      </p>
    </Shell>
  );
}
