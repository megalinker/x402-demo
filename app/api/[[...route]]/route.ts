import { Hono } from "hono";
import { handle } from "hono/vercel";
import { logger } from "hono/logger";

import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

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

// 1. Standard Request Timing
app.use("*", logger());

// 2. x402 Deep Inspection Middleware
// This sits before the paymentMiddleware to "spy" on the headers.
app.use("*", async (c, next) => {
    console.log(`\n⬇️ [SERVER INCOMING] ${c.req.method} ${c.req.path}`);

    // Inspect Incoming Authorization (The Client's Payment Proof)
    const authHeader = c.req.header("Authorization");
    if (authHeader) {
        console.log(`🔍 [SERVER] Authorization Header Present`);
        try {
            // Authorization format: "Scheme <Base64Token>"
            const parts = authHeader.split(" ");
            if (parts.length === 2) {
                const decoded = JSON.parse(Buffer.from(parts[1], "base64").toString());
                console.log(`🔓 [SERVER] Decoded Payment Proof:`);
                console.dir(decoded, { depth: null, colors: true });
            }
        } catch (e) {
            console.log(`⚠️ [SERVER] Could not decode auth token:`, e);
        }
    } else {
        console.log(`⚪ [SERVER] No Authorization Header (Discovery Phase)`);
    }

    await next();

    // Inspect Outgoing Response (The Server's Payment Terms)
    console.log(`⬆️ [SERVER OUTGOING] Status: ${c.res.status}`);

    if (c.res.status === 402) {
        const pr = c.res.headers.get("Payment-Required");
        if (pr) {
            try {
                // Payment-Required format: "<Base64JSON>"
                const decodedPr = JSON.parse(Buffer.from(pr, "base64").toString());
                console.log(`📝 [SERVER] Sending Payment Terms (402):`);
                console.dir(decodedPr, { depth: null, colors: true });
            } catch (e) {
                console.log(`⚠️ [SERVER] Could not decode Payment-Required header:`, e);
            }
        }
    }
});

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
        confirm: true,
        return_url: process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}/api/paid`
            : "http://localhost:3000/api/paid",
        metadata: { sku: "conceptual_good_v1", channel: "x402" },
    });

    const nextAction: any = paymentIntent.next_action;
    const depositDetails = nextAction?.crypto_collect_deposit_details;
    const payToAddress = depositDetails?.deposit_addresses?.["base"]?.address;

    if (!payToAddress) {
        if (nextAction?.type === "redirect_to_url") {
            console.warn("Stripe returned a redirect. Using fallback address for demo.");
            return "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
        }
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