"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/workspace";
import { createFolder, saveReport, deleteReport } from "@/lib/reports/store";
import { ALL_SECTIONS } from "@/lib/reports/data";

async function owner() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) throw new Error("Accès réservé.");
  return ctx;
}

export async function createFolderAction(form: FormData) {
  await owner();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return;
  const customer = String(form.get("customer_id") ?? "") || null;
  await createFolder(name, customer);
  revalidatePath("/rapports");
}

export async function saveReportAction(form: FormData) {
  await owner();
  const get = (k: string) => String(form.get(k) ?? "");
  const sections = ALL_SECTIONS.filter((k) => form.get(`s_${k}`) === "on");
  const [customerId, accountName] = get("account").split("|");
  const id = await saveReport({
    id: get("id") || undefined,
    folder_id: get("folder_id") || null,
    customer_id: customerId,
    account_name: accountName || customerId,
    title: get("title") || null,
    template: get("template") || "mensuel",
    mode: get("mode") || "leadgen",
    theme: get("theme") || "clair",
    period: get("period") || "30",
    compare: form.get("compare") === "on",
    client_period: form.get("client_period") === "on",
    intro: get("intro") || null,
    analysis: get("analysis") || null,
    optimisations: get("optimisations") || null,
    sections,
    author: get("author") || null,
  });
  revalidatePath("/rapports");
  redirect(`/rapports/${id}?saved=1`);
}

export async function deleteReportAction(form: FormData) {
  await owner();
  await deleteReport(String(form.get("id")));
  revalidatePath("/rapports");
  redirect("/rapports");
}
