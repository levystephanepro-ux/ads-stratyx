// Témoin du menu : renvoie le résumé du dernier bilan de santé (aucun test lancé ici).
import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/workspace";
import { getHealthSummary } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) return NextResponse.json({ summary: null }, { status: 403 });
  return NextResponse.json({ summary: await getHealthSummary() });
}
