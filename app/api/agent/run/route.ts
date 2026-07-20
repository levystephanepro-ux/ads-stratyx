// "Lancer maintenant" depuis l'UI : exécute une tâche à la demande, renvoie le
// rapport pour affichage immédiat ET envoie l'email (pour tester tout le tunnel).
//
// Sécurité : token owner (MCP_SHARED_TOKEN) ou token workspace (client SaaS).
// Pour un client : tâche scopée à son workspace, quota IA vérifié, exécution
// restreinte à SON compte Google Ads, rapport envoyé à SON email.
import { NextResponse } from "next/server";
import { getTask, markTaskRun, getSetting } from "@/lib/agent/store";
import { runTask } from "@/lib/agent/run";
import { sendAgentEmail } from "@/lib/agent/email";
import { addMonthlyCost } from "@/lib/agent/cost";
import { tokenValueOk, getWorkspaceIdFromValue } from "@/lib/api-auth";
import { getWorkspaceBilling, getWorkspaceOwnerEmail } from "@/lib/billing";
import { isOwnerEmail } from "@/lib/owner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let payload: { taskId?: string; token?: string; email?: boolean; customerId?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "corps JSON invalide" }, { status: 400 });
  }

  if (!(await tokenValueOk(payload.token))) {
    return NextResponse.json({ error: "token invalide" }, { status: 401 });
  }

  if (!payload.taskId) {
    return NextResponse.json({ error: "taskId manquant" }, { status: 400 });
  }

  const workspaceId = await getWorkspaceIdFromValue(payload.token);
  const task = await getTask(payload.taskId, workspaceId);
  if (!task) {
    return NextResponse.json({ error: "tâche inconnue" }, { status: 404 });
  }

  let customerId = payload.customerId;
  let emailTo: string | null = null;
  if (workspaceId) {
    const billing = await getWorkspaceBilling(workspaceId);
    if (!billing.allowed) {
      return NextResponse.json({ error: billing.reason }, { status: 402 });
    }
    const defaultCustomer = await getSetting("default_customer_id", workspaceId);
    emailTo = await getWorkspaceOwnerEmail(workspaceId);
    if (isOwnerEmail(emailTo)) {
      // Owner : libre de cibler n'importe quel compte du MCC.
      customerId = payload.customerId ?? defaultCustomer ?? undefined;
    } else {
      if (!defaultCustomer) {
        return NextResponse.json(
          { error: "Aucun compte Google Ads relié à ton espace. Va dans Connexions." },
          { status: 409 },
        );
      }
      // Isolation : un client n'exécute que sur son compte par défaut.
      customerId = defaultCustomer;
    }
  }

  try {
    const r = await runTask(task, customerId);

    let emailStatus: string | null = null;
    if (payload.email !== false) {
      try {
        await sendAgentEmail(`🤖 ${task.name}`, r.summary, emailTo);
        emailStatus = "envoyé";
      } catch (e) {
        emailStatus = `non envoyé : ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    await markTaskRun(task.id, "ok (manuel)");
    await addMonthlyCost(r.usage.costUsd, "agent", workspaceId);

    return NextResponse.json({
      summary: r.summary,
      steps: r.steps,
      toolCalls: r.toolCalls,
      emailStatus,
      costUsd: r.usage.costUsd,
      inputTokens: r.usage.inputTokens,
      outputTokens: r.usage.outputTokens,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
