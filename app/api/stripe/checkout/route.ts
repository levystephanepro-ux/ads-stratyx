import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const base = getAppUrl();
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    return NextResponse.json({ error: "STRIPE_PRICE_ID manquant" }, { status: 500 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    success_url: `${base}/dashboard?checkout=success`,
    cancel_url: `${base}/pricing?checkout=cancelled`,
    subscription_data: {
      metadata: { user_id: user.id },
    },
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
