import { NextResponse } from "next/server";
import { tokenOk } from "@/lib/api-auth";
import { queryPerformance, dateRange, type ScDimension } from "@/lib/search-console/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await tokenOk(req))) return NextResponse.json({ error: "token invalide" }, { status: 401 });

  const url = new URL(req.url);
  const siteUrl = url.searchParams.get("site") ?? "";
  const days = Number(url.searchParams.get("days") ?? 28);
  const dim = (url.searchParams.get("dim") ?? "query") as ScDimension;

  if (!siteUrl) return NextResponse.json({ error: "site manquant" }, { status: 400 });

  const workspaceToken = req.headers.get("x-app-token") ?? process.env.MCP_SHARED_TOKEN ?? "";
  try {
    const { startDate, endDate } = dateRange(days);
    const rows = await queryPerformance(siteUrl, startDate, endDate, [dim], 50, workspaceToken);
    return NextResponse.json({ rows, startDate, endDate });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
