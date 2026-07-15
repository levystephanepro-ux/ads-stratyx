// Endpoint déclenché par Vercel Cron (voir vercel.json). Une fois par jour, on
// lance les tâches dues (lues depuis la base) et on envoie chaque rapport par email.
//
// Sécurité : Vercel Cron ajoute `Authorization: Bearer <CRON_SECRET>` si la
// variable est définie. On la vérifie pour bloquer tout déclenchement externe.
import { NextResponse } from "next/server";
import { listTasks, taskDue, markTaskRun } from "@/lib/agent/store";
import { runTask } from "@/lib/agent/run";
import { sendAgentEmail } from "@/lib/agent/email";

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
  const tasks = await listTasks();
  const due = tasks.filter((t) => taskDue(t, now));

  const results: Array<{ task: string; ok: boolean; detail: string }> = [];
  for (const task of due) {
    try {
      const r = await runTask(task);
      await sendAgentEmail(`🤖 ${task.name}`, r.summary);
      await markTaskRun(task.id, "ok");
      results.push({ task: task.id, ok: true, detail: `${r.steps} étapes` });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      await markTaskRun(task.id, `erreur: ${detail}`);
      results.push({ task: task.id, ok: false, detail });
    }
  }

  return NextResponse.json({ ranAt: now.toISOString(), ran: results.length, results });
}
