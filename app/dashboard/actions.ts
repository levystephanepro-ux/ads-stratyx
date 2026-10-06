"use server";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/workspace";
import { setMonthlyBudget } from "@/lib/dashboard";

/** Enregistre le budget mensuel d'un compte (vide = retirer). */
export async function setMonthlyBudgetAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  const id = String(form.get("customer_id") ?? "");
  if (!/^\d{6,12}$/.test(id)) return;
  const raw = String(form.get("amount") ?? "").replace(/\s/g, "").replace(",", ".");
  const n = Number(raw);
  await setMonthlyBudget(id, raw && Number.isFinite(n) ? n : null);
  revalidatePath("/dashboard");
}
