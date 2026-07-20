// Modification / suppression d'un template.
import { NextResponse } from "next/server";
import { tokenOk, isOwnerToken } from "@/lib/api-auth";
import { updateTemplate, deleteTemplate } from "@/lib/agent/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// La bibliothèque de templates est partagée : modifications réservées au
// propriétaire de la plateforme.
function ownerOnly(req: Request): NextResponse | null {
  if (!isOwnerToken(req.headers.get("x-app-token"))) {
    return NextResponse.json(
      { error: "Bibliothèque gérée par ads·stratyx — lecture seule." },
      { status: 403 },
    );
  }
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await tokenOk(req))) {
    return NextResponse.json({ error: "token invalide" }, { status: 401 });
  }
  const denied = ownerOnly(req);
  if (denied) return denied;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  try {
    await updateTemplate(id, {
      name: b.name,
      description: b.description,
      category: b.category,
      prompt: b.prompt,
      icon: b.icon,
    });
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
  const denied = ownerOnly(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
