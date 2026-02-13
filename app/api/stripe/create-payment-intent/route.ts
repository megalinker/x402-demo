import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_USD_CENTS = 50; // $0.50 conceptual good (server-authoritative)

export async function POST() {
  // In real life, look up SKU -> price on the server, never trust client input.

  const pi = await stripe.paymentIntents.create({
    amount: PRICE_USD_CENTS,
    currency: "usd",
    // This allows Stripe’s front-end products to show relevant methods you enabled,
    // including stablecoin/crypto if available for your account.
    automatic_payment_methods: { enabled: true },
    metadata: {
      sku: "conceptual_good_v1",
    },
  });

  return NextResponse.json({ clientSecret: pi.client_secret });
}
