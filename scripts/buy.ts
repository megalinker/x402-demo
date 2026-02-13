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

// --- DEEP LOGGING HELPERS START ---

/**
 * Tries to decode a Base64 string (or "Scheme Base64" string) into JSON.
 * Returns the object if successful, or the raw string if not.
 */
function tryDecode(str: string | null) {
  if (!str) return null;
  try {
    const payload = str.includes(" ") ? str.split(" ")[1] : str;
    return JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
  } catch (e) {
    return `(Raw) ${str}`;
  }
}

const explicitFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  // 1. SMART URL EXTRACTION
  // If 'input' is a Request object, get .url from it. Otherwise use the string/URL.
  let url: string;
  let headers: Headers;

  if (input instanceof Request) {
    url = input.url;
    // If input is a Request, headers might be on the object itself OR in init
    headers = new Headers(input.headers);
    if (init?.headers) {
      new Headers(init.headers).forEach((v, k) => headers.append(k, v));
    }
  } else {
    url = input.toString();
    headers = new Headers(init?.headers);
  }

  const method = (input instanceof Request ? input.method : init?.method) || "GET";

  console.log(`\n================= 📤 CLIENT REQUEST =================`);
  console.log(`${method} ${url}`);

  // 2. INSPECT MERGED HEADERS
  let hasAuth = false;
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "authorization") {
      hasAuth = true;
      console.log(`\n🔑 Authorization Header Detected! Decoding Proof...`);
      console.dir(tryDecode(value), { depth: null, colors: true });
    } else {
      // Filter out boring headers if you want, or log all
      console.log(`> ${key}: ${value}`);
    }
  });

  if (!hasAuth) {
    console.log(`(No Authorization header - Initial Discovery Request)`);
  }

  // --- EXECUTE REAL FETCH ---
  const res = await fetch(input, init);
  // -------------------------

  console.log(`\n================= 📥 CLIENT RESPONSE =================`);
  console.log(`STATUS: ${res.status} ${res.statusText}`);

  const pr = res.headers.get("Payment-Required");
  if (res.status === 402 && pr) {
    console.log(`\n🛑 402 Payment Required! Decoding Terms...`);
    console.dir(tryDecode(pr), { depth: null, colors: true });
  }

  const authInfo = res.headers.get("Authentication-Info");
  if (authInfo) {
    console.log(`\n✅ Authentication-Info (Settlement Receipt):`);
    console.log(authInfo);
  }

  console.log(`====================================================\n`);

  return res;
};

// --- DEEP LOGGING HELPERS END ---

// 3. Wrap the explicit fetch with the Payment Logic
const fetchWithPayment = wrapFetchWithPayment(explicitFetch, client);

async function main() {
  // Default to the Vercel URL, but allow local override via args
  const url = process.argv[2] || "https://x402-demo-omega.vercel.app/api/paid";

  console.log(`\n🚀 Starting purchase flow for: ${url}`);

  // This single call will trigger the logging twice:
  // 1. First for the 402 (Discovery) -> Logs "Payment-Required"
  // 2. Second for the 200 (Verification) -> Logs "Authorization"
  const res = await fetchWithPayment(url, { method: "GET" });

  console.log(`\n---------------------------------------------------------`);
  console.log("FINAL APP STATUS:", res.status);

  if (res.ok) {
    const body = await res.json();
    console.log("FINAL BODY:", body);

    // Optional: Parse the settlement receipt using the SDK helper
    const httpClient = new x402HTTPClient(client);
    const paymentResponse = httpClient.getPaymentSettleResponse((name) =>
      res.headers.get(name)
    );
    if (paymentResponse) {
      console.log("SDK SETTLEMENT RECEIPT:", paymentResponse);
    }
  } else {
    console.log("Request failed:", await res.text());
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});