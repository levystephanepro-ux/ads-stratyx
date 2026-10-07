// Client actif : liste pour le sélecteur (GET) et changement (POST).
import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/workspace";
import { listClients } from "@/lib/clients/store";
import { getActiveClient, setActiveClientCookie } from "@/lib/clients/active";
import { getBaseDefaultAccount } from "@/lib/google-ads/default-account";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) return NextResponse.json({ clients: [], active: null });
  const [clients, active, base] = await Promise.all([
    listClients().catch(() => []),
    getActiveClient(),
    getBaseDefaultAccount().catch(() => null),
  ]);
  return NextResponse.json({ defaultAccount: base, clients: clients.map((c) => ({ id: c.id, name: c.name, linked: !!c.customer_id, customerId: c.customer_id ?? null })), active: active?.id ?? null });
}

export async function POST(req: Request) {
  const ctx = await getDashboardContext();
  if (!ctx.isOwner) return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string | null };
  await setActiveClientCookie(id && /^[0-9a-f-]{36}$/i.test(id) ? id : null);
  return NextResponse.json({ ok: true });
}
