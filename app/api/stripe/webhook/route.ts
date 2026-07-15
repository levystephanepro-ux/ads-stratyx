import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient as createSupabase } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function periodEnd(sub: AnyObj): string | null {
  const ts = sub.current_period_end ?? sub.billing_cycle_anchor;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: AnyObj;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret) as AnyObj;
  } catch {
    return NextResponse.json({ error: "signature invalide" }, { status: 400 });
  }

  const admin = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const obj: AnyObj = event.data?.object ?? {};

  switch (event.type) {
    case "checkout.session.completed": {
      const userId = obj.metadata?.user_id;
      const customerId = obj.customer;
      const subscriptionId = obj.subscription;
      if (!userId || !subscriptionId) break;

      const sub = await getStripe().subscriptions.retrieve(subscriptionId) as AnyObj;
      await admin.from("subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: "active",
        plan: "pro",
        current_period_end: periodEnd(sub),
        updated_at: new Date().toISOString(),
      });
      break;
    }

    case "customer.subscription.updated": {
      const userId = obj.metadata?.user_id;
      if (!userId) break;
      await admin.from("subscriptions").update({
        status: obj.status,
        current_period_end: periodEnd(obj),
        updated_at: new Date().toISOString(),
      }).eq("stripe_subscription_id", obj.id);
      break;
    }

    case "customer.subscription.deleted": {
      await admin.from("subscriptions").update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      }).eq("stripe_subscription_id", obj.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
