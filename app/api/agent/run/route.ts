// "Lancer maintenant" depuis l'UI : exécute une tâche à la demande, renvoie le
// rapport pour affichage immédiat ET envoie l'email (pour tester tout le tunnel).
//
// Sécurité : protégé par le token partagé (MCP_SHARED_TOKEN).
import { NextResponse } from "next/server";
import { getTask, markTaskRun } from "@/lib/agent/store";
import { runTask } from "@/lib/agent/run";
import { sendAgentEmail } from "@/lib/agent/email";
import { addMonthlyCost } from "@/lib/agent/cost";

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

  const required = process.env.MCP_SHARED_TOKEN;
  if (required && payload.token !== required) {
    return NextResponse.json({ error: "token invalide" }, { status: 401 });
  }

  if (!payload.taskId) {
    return NextResponse.json({ error: "taskId manquant" }, { status: 400 });
  }

  const task = await getTask(payload.taskId);
  if (!task) {
    return NextResponse.json({ error: "tâche inconnue" }, { status: 404 });
  }

  try {
    const r = await runTask(task, payload.customerId);

    let emailStatus: string | null = null;
    if (payload.email !== false) {
      try {
        await sendAgentEmail(`🤖 ${task.name}`, r.summary);
        emailStatus = "envoyé";
      } catch (e) {
        emailStatus = `non envoyé : ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    await markTaskRun(task.id, "ok (manuel)");
    await addMonthlyCost(r.usage.costUsd, "agent");

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
