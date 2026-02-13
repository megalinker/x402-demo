import { createWalletClient, http, parseAbi, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import "dotenv/config";

if (!process.env.PRIVATE_KEY) {
  throw new Error("Please set PRIVATE_KEY in your .env file");
}

const privateKey = process.env.PRIVATE_KEY.startsWith("0x")
  ? process.env.PRIVATE_KEY
  : `0x${process.env.PRIVATE_KEY}`;
const account = privateKeyToAccount(privateKey as `0x${string}`);

const client = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
}).extend(publicActions);

async function main() {
  const url = process.argv[2] || "https://x402-demo-omega.vercel.app/api/paid";
  console.log(`Checking ${url}...`);

  const res = await fetch(url);
  if (res.ok) {
    console.log("Access granted!");
    console.log(await res.json());
    return;
  }

  if (res.status !== 402) {
    console.log("Response status:", res.status);
    console.log(await res.text());
    return;
  }
  console.log("Access denied (402). Purchasing...");

  const header = res.headers.get("payment-required");
  if (!header) {
    console.error("No payment-required header found");
    return;
  }

  const reqs = JSON.parse(Buffer.from(header, "base64").toString());
  const option = reqs.accepts[0];
  console.log("Payment requirements:", option);

  const tokenAddress = option.asset as `0x${string}`;
  const to = option.payTo as `0x${string}`;
  const amount = BigInt(option.amount);

  console.log(`Sending ${amount} units of ${tokenAddress} to ${to}...`);

  const abi = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);

  const hash = await client.writeContract({
    address: tokenAddress,
    abi,
    functionName: "transfer",
    args: [to, amount],
  });

  console.log("Transaction sent:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log("Transaction confirmed in block", receipt.blockNumber);

  console.log("Verifying access...");
  const authPayload = JSON.stringify({ hash });
  const authHeader = `Exact ${Buffer.from(authPayload).toString("base64")}`;

  const res2 = await fetch(url, {
    headers: { Authorization: authHeader },
  });

  if (res2.ok) {
    console.log("Access granted!");
    console.log(await res2.json());
  } else {
    console.error("Access denied:", res2.status);
    console.error(await res2.text());
  }
}

main().catch(console.error);