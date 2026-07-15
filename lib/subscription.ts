import { redirect } from "next/navigation";
import type { DashboardContext } from "./workspace";

export function requireSub(ctx: DashboardContext) {
  if (ctx.isBlocked) redirect("/pricing?trial=expired");
}
