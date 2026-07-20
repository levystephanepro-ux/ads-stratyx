// Page Copilote — chat pour piloter tes Google Ads sans quitter l'app.
import Copilote from "@/components/Copilote";
import Shell from "@/components/Shell";
import { getDefaultAccountInfo } from "@/lib/google-ads/default-account";
import { getDashboardContext } from "@/lib/workspace";
import { requireSub } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function CopilotePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; q?: string }>;
}) {
  const { q } = await searchParams;
  // L'accès est protégé par le middleware (session Supabase). Le token utilisé
  // pour les appels API est celui du workspace de l'utilisateur connecté.
  const ctx = await getDashboardContext();
  requireSub(ctx);
  const tok = ctx.mcpToken;
  const anthropicMissing = !process.env.ANTHROPIC_API_KEY;
  const accountInfo = await getDefaultAccountInfo({
    workspaceId: ctx.workspaceId,
    isOwner: ctx.isOwner,
  });

  return (
    <Shell active="copilote" token={tok} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner}>
      <h1 className="page-title">💬 Copilote</h1>
      <p className="page-lede">
        Discute avec tes campagnes en langage naturel. Le copilote interroge ton
        compte en direct et peut proposer des actions (avec ta confirmation).
      </p>

      {anthropicMissing ? (
        <div
          className="card"
          style={{ borderColor: "color-mix(in srgb, #fbbf24 40%, transparent)" }}
        >
          <strong>Clé API Anthropic manquante.</strong>
          <p className="subtitle" style={{ marginTop: 6, marginBottom: 0 }}>
            Ajoute <span className="mono" style={{ display: "inline", padding: "1px 6px" }}>ANTHROPIC_API_KEY</span>{" "}
            dans Vercel pour activer le Copilote.
          </p>
        </div>
      ) : (
        <Copilote
          token={tok}
          initialQuestion={q ?? ""}
          accountName={accountInfo?.name}
        />
      )}
    </Shell>
  );
}
