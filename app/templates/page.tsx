// Page Templates — bibliothèque de prompts modifiables (recherche + filtres).
import { listTemplates, supabaseReady } from "@/lib/agent/store";
import TemplatesManager from "@/components/TemplatesManager";
import Shell from "@/components/Shell";
import { getDashboardContext } from "@/lib/workspace";
import { requireSub } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  // Accès protégé par le middleware (session Supabase).
  const ctx = await getDashboardContext();
  requireSub(ctx);

  const tok = ctx.mcpToken;
  const dbReady = supabaseReady();
  const templates = await listTemplates();

  return (
    <Shell active="templates" token={tok} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner}>
      <h1 className="page-title">📋 Templates</h1>
      <p className="page-lede">
        Ta bibliothèque de prompts réutilisables. Modifie-les, crée les tiens, puis
        transforme-les en agent ou ouvre-les dans le Copilote.
      </p>

      <TemplatesManager templates={templates} token={tok} dbReady={dbReady} />
    </Shell>
  );
}
