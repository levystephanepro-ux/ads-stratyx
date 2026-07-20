// Endpoint déclenché par Vercel Cron (voir vercel.json). Une fois par jour, on
// lance les tâches dues — globales (owner) ET par workspace client — et on
// envoie chaque rapport par email au bon destinataire.
//
// Pour un workspace client : quota IA vérifié avant exécution, agent restreint
// à SON compte Google Ads, rapport envoyé à l'email de l'owner du workspace.
//
// Sécurité : Vercel Cron ajoute `Authorization: Bearer <CRON_SECRET>` si la
// variable est définie. On la vérifie pour bloquer tout déclenchement externe.
import { NextResponse } from "next/server";
import { listAllTasks, taskDue, markTaskRun, getSetting } from "@/lib/agent/store";
import { runTask } from "@/lib/agent/run";
import { sendAgentEmail } from "@/lib/agent/email";
import { addMonthlyCost } from "@/lib/agent/cost";
import { getWorkspaceBilling, getWorkspaceOwnerEmail } from "@/lib/billing";
import { isOwnerEmail } from "@/lib/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const tasks = await listAllTasks();
  const due = tasks.filter((t) => taskDue(t, now));

  const results: Array<{ task: string; ok: boolean; detail: string }> = [];
  for (const task of due) {
    try {
      let customerId: string | undefined;
      let emailTo: string | null = null;

      if (task.workspace_id) {
        const billing = await getWorkspaceBilling(task.workspace_id);
        if (!billing.allowed) {
          await markTaskRun(task.id, `ignoré : ${billing.reason}`);
          results.push({ task: task.id, ok: false, detail: `ignoré : ${billing.reason}` });
          continue;
        }
        const def = await getSetting("default_customer_id", task.workspace_id);
        emailTo = await getWorkspaceOwnerEmail(task.workspace_id);
        if (!def && !isOwnerEmail(emailTo)) {
          // Client sans compte relié : on n'exécute pas (l'owner retombe sur
          // le compte global env).
          await markTaskRun(task.id, "ignoré : aucun compte Google Ads relié");
          results.push({ task: task.id, ok: false, detail: "aucun compte relié" });
          continue;
        }
        customerId = def ?? undefined;
      }

      const r = await runTask(task, customerId);
      await sendAgentEmail(`🤖 ${task.name}`, r.summary, emailTo);
      await markTaskRun(task.id, "ok");
      await addMonthlyCost(r.usage.costUsd, "agent", task.workspace_id);
      results.push({ task: task.id, ok: true, detail: `${r.steps} étapes` });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      await markTaskRun(task.id, `erreur: ${detail}`);
      results.push({ task: task.id, ok: false, detail });
    }
  }

  return NextResponse.json({ ranAt: now.toISOString(), ran: results.length, results });
}
