// Création d'une tâche d'Agent IA.
import { NextResponse } from "next/server";
import { tokenOk, getWorkspaceId } from "@/lib/api-auth";
import { createTask, listTasks } from "@/lib/agent/store";
import { getWorkspaceBilling } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await tokenOk(req))) {
    return NextResponse.json({ error: "token invalide" }, { status: 401 });
  }
  const workspaceId = await getWorkspaceId(req);
  if (workspaceId) {
    const billing = await getWorkspaceBilling(workspaceId);
    if (!billing.allowed) {
      return NextResponse.json({ error: billing.reason }, { status: 402 });
    }
    const existing = await listTasks(workspaceId);
    if (existing.length >= billing.limits.maxAgents) {
      return NextResponse.json(
        {
          error:
            `Ton plan ${billing.limits.label} permet ${billing.limits.maxAgents} agents ` +
            `maximum. Supprime un agent ou passe au plan supérieur.`,
        },
        { status: 403 },
      );
    }
  }
  const b = await req.json().catch(() => ({}));
  if (!b.name?.trim() || !b.prompt?.trim()) {
    return NextResponse.json(
      { error: "nom et prompt obligatoires" },
      { status: 400 },
    );
  }
  const frequency =
    b.frequency === "weekly" ? "weekly" : b.frequency === "monthly" ? "monthly" : "daily";
  try {
    const t = await createTask({
      name: b.name.trim(),
      description: b.description?.trim() ?? "",
      prompt: b.prompt.trim(),
      category: typeof b.category === "string" ? b.category.trim() : "",
      frequency,
      day_of_week: frequency === "weekly"
        ? (Number.isInteger(b.day_of_week) ? b.day_of_week : 1)
        : null,
      day_of_month: frequency === "monthly"
        ? (Number.isInteger(b.day_of_month) ? b.day_of_month : 1)
        : null,
      run_hour_utc: Number.isInteger(b.run_hour_utc) ? b.run_hour_utc : 7,
      model: typeof b.model === "string" && b.model.length > 0
        ? b.model
        : "claude-haiku-4-5-20251001",
      enabled: b.enabled !== false,
      allow_write: b.allow_write === true,
    }, workspaceId);
    return NextResponse.json(t);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
