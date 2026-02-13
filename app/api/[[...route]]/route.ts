import { Hono } from "hono";
import { handle } from "hono/vercel";

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

const facilitatorClient = new HTTPFacilitatorClient({
    url: process.env.X402_FACILITATOR_URL!,
});

const resourceServer = new x402ResourceServer(facilitatorClient).register(
    X402_NETWORK_ID,
    new ExactEvmScheme()
);

const PRICE_USD = 0.5;

// ... inside app/api/[[...route]]/route.ts

async function createPayToAddress(context: any) {
    // 1. ROBUST HEADER EXTRACTION
    let authHeader: string | undefined | null = context.paymentHeader;

    // If not pre-populated, try to fish it out of the Hono Request object
    if (!authHeader && context.req) {
        // Try the standard Hono method first (handles case-insensitivity)
        if (typeof context.req.header === "function") {
            authHeader = context.req.header("Authorization");
        }
        
        // Fallback: Check raw headers if the method failed or returned nothing
        if (!authHeader && context.req.headers) {
            // If headers is a Map/Headers object
            if (typeof context.req.headers.get === "function") {
                authHeader = context.req.headers.get("Authorization");
            } 
            // If headers is a plain object
            else {
                authHeader = context.req.headers["authorization"] || context.req.headers["Authorization"];
            }
        }
    }

    // 2. DECODE AND RETURN IF FOUND
    if (authHeader) {
        // Strip the "Exact " prefix if present
        if (authHeader.startsWith("Exact ")) {
            authHeader = authHeader.substring(6);
        }

        try {
            const decoded = JSON.parse(Buffer.from(authHeader, "base64").toString());
            const toAddress = decoded.payload?.authorization?.to;

            // Log success to Vercel logs so you know it worked
            console.log(`[createPayToAddress] Recovered address from header: ${toAddress}`);
            
            if (toAddress && typeof toAddress === "string") {
                return toAddress;
            }
        } catch (e) {
            console.error("[createPayToAddress] Failed to decode header:", e);
        }
    } else {
        // Log failure - this explains why you get the Stripe warning later
        console.log("[createPayToAddress] No Authorization header found. Context keys:", Object.keys(context));
    }

    // 3. FALLBACK: NEW STRIPE ORDER
    // This code only runs if the header was missing (First request) or extraction failed.
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
        // This warning is NORMAL for the *first* request (discovery) because Stripe
        // crypto payments usually require a redirect. We use the fallback for the demo.
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
