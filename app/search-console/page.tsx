import { getDashboardContext } from "@/lib/workspace";
import { requireSub } from "@/lib/subscription";
import Shell from "@/components/Shell";
import SearchConsoleClient from "./SearchConsoleClient";
import { isScLive } from "@/lib/search-console/config";

export const dynamic = "force-dynamic";

export default async function SearchConsolePage() {
  const ctx = await getDashboardContext();
  requireSub(ctx);
  return (
    <Shell active="search-console" token={ctx.mcpToken} trialDaysLeft={ctx.trialDaysLeft} showAdmin={ctx.isOwner}>
      <SearchConsoleClient token={ctx.mcpToken} isMock={!isScLive()} />
    </Shell>
  );
}
