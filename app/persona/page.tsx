import { getDashboardContext } from "@/lib/workspace";
import { requireSub } from "@/lib/subscription";
import Shell from "@/components/Shell";
import PersonaBuilder from "./PersonaBuilder";

export const dynamic = "force-dynamic";

export default async function PersonaPage() {
  const ctx = await getDashboardContext();
  requireSub(ctx);
  return (
    <Shell active="persona" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner}>
      <PersonaBuilder token={ctx.mcpToken} />
    </Shell>
  );
}
