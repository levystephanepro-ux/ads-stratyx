"use server";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/workspace";
import { runAuditForOwner } from "@/lib/audit/run";

/** Relance le diagnostic à la demande (owner uniquement, 0 crédit IA). */
export async function runAuditNow(): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) return;
  await runAuditForOwner();
  revalidatePath("/waste");
}
