// Modification / suppression d'une tâche d'Agent IA.
import { NextResponse } from "next/server";
import { tokenOk, getWorkspaceId } from "@/lib/api-auth";
import { updateTask, deleteTask } from "@/lib/agent/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await tokenOk(req))) {
    return NextResponse.json({ error: "token invalide" }, { status: 401 });
  }
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string") patch.name = b.name.trim();
  if (typeof b.description === "string") patch.description = b.description.trim();
  if (typeof b.prompt === "string") patch.prompt = b.prompt.trim();
  if (b.frequency === "daily" || b.frequency === "weekly" || b.frequency === "monthly") {
    patch.frequency = b.frequency;
    patch.day_of_week = b.frequency === "weekly"
      ? (Number.isInteger(b.day_of_week) ? b.day_of_week : 1)
      : null;
    patch.day_of_month = b.frequency === "monthly"
      ? (Number.isInteger(b.day_of_month) ? b.day_of_month : 1)
      : null;
  }
  if (Number.isInteger(b.run_hour_utc)) patch.run_hour_utc = b.run_hour_utc;
  if (typeof b.model === "string" && b.model.length > 0) patch.model = b.model;
  if (typeof b.category === "string") patch.category = b.category.trim();
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  if (typeof b.allow_write === "boolean") patch.allow_write = b.allow_write;

  try {
    // Scope client : un token workspace ne modifie que ses propres tâches.
    await updateTask(id, patch, await getWorkspaceId(req));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await tokenOk(req))) {
    return NextResponse.json({ error: "token invalide" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await deleteTask(id, await getWorkspaceId(req));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
