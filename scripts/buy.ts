// scripts/buy.ts
import "dotenv/config";

import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

if (!process.env.PRIVATE_KEY) {
  throw new Error("Please set PRIVATE_KEY in your .env file");
}

const privateKey = process.env.PRIVATE_KEY.startsWith("0x")
  ? process.env.PRIVATE_KEY
  : `0x${process.env.PRIVATE_KEY}`;

const signer = privateKeyToAccount(privateKey as `0x${string}`);

// 1. Setup the Client
const client = new x402Client();
registerExactEvmScheme(client, { signer });

// 2. Create an "Explicit" Fetch Wrapper
// This functions exactly like normal fetch but logs the conversation
const explicitFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input.toString();
  const method = init?.method || "GET";
  
  // Check if we are sending an Authorization header (happens on the retry)
  const headers = new Headers(init?.headers);
  const hasAuth = headers.has("Authorization");

  console.log(`\n---------------------------------------------------------`);
  console.log(`HTTP REQUEST: ${method} ${url}`);
  if (hasAuth) {
    console.log(`>> Authorization: PRESENT (Sending Proof/Payment)`);
  } else {
    console.log(`>> Authorization: NONE (Discovery Phase)`);
  }

  // --- EXECUTE REAL FETCH ---
  const res = await fetch(input, init);
  // -------------------------

  console.log(`HTTP RESPONSE: ${res.status} ${res.statusText}`);

  if (res.status === 402) {
    console.log(`>> 🛑 Status 402 Detected. Checking Payment-Required header...`);
    const pr = res.headers.get("Payment-Required");
    if (pr) {
      const details = JSON.parse(Buffer.from(pr, "base64").toString("utf8"));
      console.log(`>> 📋 Requirements found:`, JSON.stringify(details, null, 2));
      console.log(`>> 🤖 SDK will now execute payment logic and retry...`);
    }
  } else if (res.ok) {
    console.log(`>> ✅ Success! Content delivered.`);
  }

  return res;
};

// 3. Wrap the explicit fetch with the Payment Logic
const fetchWithPayment = wrapFetchWithPayment(explicitFetch, client);

async function main() {
  const url = process.argv[2] || "https://x402-demo-omega.vercel.app/api/paid";
  
  console.log(`\n🚀 Starting purchase flow for: ${url}`);

  // This single call will trigger the logging twice:
  // 1. First for the 402 (Discovery)
  // 2. Second for the 200 (Verification)
  const res = await fetchWithPayment(url, { method: "GET" });

  console.log(`\n---------------------------------------------------------`);
  console.log("FINAL STATUS:", res.status);

  if (res.ok) {
    const body = await res.json();
    console.log("FINAL BODY:", body);

    // Optional: Parse the settlement receipt
    const httpClient = new x402HTTPClient(client);
    const paymentResponse = httpClient.getPaymentSettleResponse((name) =>
      res.headers.get(name)
    );
    if (paymentResponse) {
        console.log("SETTLEMENT RECEIPT:", paymentResponse);
    }
  } else {
    console.log("Request failed:", await res.text());
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});