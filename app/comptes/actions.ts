"use server";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/workspace";
import { setMonitored } from "@/lib/audit/run";

export async function toggleMonitoringAction(form: FormData) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const id = String(form.get("customer_id") ?? "");
  if (!/^\d{6,12}$/.test(id)) return;
  await setMonitored(id, form.get("on") === "1");
  revalidatePath("/comptes");
}
