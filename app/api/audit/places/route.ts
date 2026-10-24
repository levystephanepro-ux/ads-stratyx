// Suggestions de fiches Google pendant la frappe (audit entreprise). Réservé au propriétaire.
import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/workspace";
import { suggestPlaces } from "@/lib/audit/places";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) return NextResponse.json({ suggestions: [], message: null }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json(await suggestPlaces(q.slice(0, 200)));
}
