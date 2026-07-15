// Création d'un template (bibliothèque de prompts).
import { NextResponse } from "next/server";
import { tokenOk } from "@/lib/api-auth";
import { createTemplate } from "@/lib/agent/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await tokenOk(req))) {
    return NextResponse.json({ error: "token invalide" }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  if (!b.name?.trim() || !b.prompt?.trim()) {
    return NextResponse.json(
      { error: "nom et prompt obligatoires" },
      { status: 400 },
    );
  }
  try {
    const t = await createTemplate({
      name: b.name.trim(),
      description: b.description?.trim() ?? "",
      category: b.category?.trim() || "Général",
      prompt: b.prompt.trim(),
      icon: b.icon?.trim() || "📋",
    });
    return NextResponse.json(t);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
