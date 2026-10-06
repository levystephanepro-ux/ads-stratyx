import { NextResponse } from "next/server";
import { tokenValueOk, getWorkspaceIdFromValue } from "@/lib/api-auth";
import { getSetting } from "@/lib/agent/store";
import { listCampaigns } from "@/lib/google-ads/client";
import { adsConfig, isLive } from "@/lib/google-ads/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = req.headers.get("x-app-token");
  if (!(await tokenValueOk(token))) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdFromValue(token);
  const customerId =
    (await getSetting("default_customer_id", workspaceId)) ||
    (isLive() ? adsConfig.customerId : null);

  if (!customerId) {
    return NextResponse.json({ campaigns: [] });
  }

  try {
    const campaigns = await listCampaigns({ customerId, refreshToken: adsConfig.refreshToken });
    return NextResponse.json({
      campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
