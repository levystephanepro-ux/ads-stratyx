import { NextResponse } from "next/server";
import { tokenValueOk, getWorkspaceIdFromValue } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { setSetting, getSetting } from "@/lib/agent/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = req.headers.get("x-app-token");
  if (!(await tokenValueOk(token))) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdFromValue(token);
  if (!workspaceId) {
    return NextResponse.json({ error: "workspace requis" }, { status: 400 });
  }

  const { customer_id } = await req.json() as { customer_id: string };
  if (!customer_id) {
    return NextResponse.json({ error: "customer_id requis" }, { status: 400 });
  }

  // Ajouter à la liste d'exclusion (fonctionne pour owner MCC + clients DB)
  const rawExcluded = await getSetting("excluded_customer_ids", workspaceId);
  const excluded: string[] = rawExcluded ? JSON.parse(rawExcluded) : [];
  if (!excluded.includes(customer_id)) {
    excluded.push(customer_id);
    await setSetting("excluded_customer_ids", JSON.stringify(excluded), workspaceId);
  }

  // Supprimer aussi de la table DB (pour les clients)
  const admin = createAdminClient();
  await admin
    .from("google_ads_connections")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("customer_id", customer_id);

  // Si c'était le compte par défaut, basculer sur le suivant
  const currentDefault = await getSetting("default_customer_id", workspaceId);
  if (currentDefault === customer_id) {
    const { data: remaining } = await admin
      .from("google_ads_connections")
      .select("customer_id")
      .eq("workspace_id", workspaceId)
      .not("customer_id", "in", `(${excluded.join(",")})`)
      .limit(1)
      .maybeSingle();
    await setSetting("default_customer_id", remaining?.customer_id ?? "", workspaceId);
  }

  return NextResponse.json({ ok: true });
}
