"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/workspace";
import { addBug, setBugDone } from "@/lib/bugs";
import { sendAgentEmail } from "@/lib/agent/email";

const NOTIFY_EMAIL = "contact@stratyxmedia.fr";

export async function reportBugAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  const text = String(form.get("text") ?? "").trim().slice(0, 4000);
  const page = String(form.get("page") ?? "").trim().slice(0, 200) || "(non précisée)";
  const back = `/bug?from=${encodeURIComponent(page)}`;
  if (!text) redirect(`${back}&err=1`);
  const bug = await addBug({ page, text, email: ctx.email ?? null, account: ctx.defaultAccountName ?? null });
  // L'email ne doit jamais faire perdre le signalement : il est déjà enregistré.
  try {
    await sendAgentEmail(
      `🐞 Bug signalé · ${page}`,
      [
        `- **Page :** ${page}`,
        ...(bug.email ? [`- **Par :** ${bug.email}`] : []),
        ...(bug.account ? [`- **Compte actif :** ${bug.account}`] : []),
        "",
        text,
        "",
        "Liste complète : https://app.stratyxmedia.fr/bug",
      ].join("\n"),
      NOTIFY_EMAIL,
    );
  } catch { /* consultable sur /bug */ }
  redirect(`${back}&ok=1`);
}

export async function toggleBugAction(form: FormData): Promise<void> {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) return;
  await setBugDone(String(form.get("id") ?? ""), form.get("done") === "1");
  revalidatePath("/bug");
}
