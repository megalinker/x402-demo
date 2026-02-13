import { Hono } from "hono";
import { handle } from "hono/vercel";

import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

import Stripe from "stripe";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** x402 expects CAIP-2 network identifiers, e.g. "eip155:84532" */
type Caip2NetworkId = `${string}:${string}`;

function requireCaip2(name: string, value: string | undefined): Caip2NetworkId {
  if (!value) throw new Error(`Missing env var: ${name}`);
  // Basic CAIP-2 shape check: namespace:reference
  if (!/^[a-z0-9]+:[a-zA-Z0-9]+$/.test(value)) {
    throw new Error(`${name} must be CAIP-2 like "eip155:84532" or "eip155:8453"`);
  }
  return value as Caip2NetworkId;
}

const X402_NETWORK_ID = requireCaip2("X402_NETWORK_ID", process.env.X402_NETWORK_ID);

const app = new Hono().basePath("/api");

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL!,
});

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  X402_NETWORK_ID,
  new ExactEvmScheme()
);

const PRICE_USD = 0.5;

async function createPayToAddress(context: any) {
  // Reuse destination if already present
  if (context.paymentHeader) {
    const decoded = JSON.parse(Buffer.from(context.paymentHeader, "base64").toString());
    const toAddress = decoded.payload?.authorization?.to;
    if (toAddress && typeof toAddress === "string") return toAddress;
  }

  const amountInCents = Math.round(PRICE_USD * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: "usd",
    payment_method_types: ["crypto"],
    payment_method_data: { type: "crypto" },

    // ✅ CRITICAL: custom mode returns deposit addresses for x402
    payment_method_options: {
      crypto: { mode: "custom" } as any, // (cast if your stripe typings lag)
    },

    confirm: true,
    metadata: { sku: "conceptual_good_v1", channel: "x402" },
  });

  const nextAction: any = paymentIntent.next_action;
  const depositDetails = nextAction?.crypto_collect_deposit_details;
  const payToAddress = depositDetails?.deposit_addresses?.["base"]?.address;

  if (!payToAddress) {
    throw new Error(
      `Missing Base deposit address. next_action.type=${nextAction?.type ?? "none"}`
    );
  }

  return payToAddress;
}

app.use(
  paymentMiddleware(
    {
      "GET /api/paid": {
        accepts: [
          {
            scheme: "exact",
            price: `$${PRICE_USD.toFixed(2)}`,
            network: X402_NETWORK_ID,
            payTo: createPayToAddress,
          },
        ],
        description: "Buy conceptual good (x402)",
        mimeType: "application/json",
      },
    },
    resourceServer
  )
);

app.get("/paid", (c) => {
  return c.json({
    ok: true,
    delivered: "your conceptual good payload here",
  });
});

export const GET = handle(app);
export const POST = handle(app);
