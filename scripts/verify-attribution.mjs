#!/usr/bin/env node
// Confirms a FaucetDrops transaction actually carries the ERC-8021 attribution
// suffix on-chain — some relayers/bundlers strip trailing calldata bytes, so
// this checks the real thing rather than trusting the client-side encode.
//
// Usage: node scripts/verify-attribution.mjs 0x<tx hash>

import { verifyTx, codeFromHostname } from "@celo/attribution-tags";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";

const hash = process.argv[2];
if (!hash) {
  console.error("Usage: node scripts/verify-attribution.mjs 0x<tx hash>");
  process.exit(1);
}

const client = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
const expectedCode = codeFromHostname("faucetdrops.io");

const result = await verifyTx({ client, hash });

if (!result) {
  console.error(`No attribution tag found on ${hash}.`);
  console.error("Either this tx predates the attribution-tag fix, or a relayer stripped the calldata suffix.");
  process.exit(1);
}

console.log(`Tag found: ${JSON.stringify(result)}`);
console.log(result.codes.includes(expectedCode) ? `Matches expected code: ${expectedCode}` : `WARNING: expected ${expectedCode}, got ${result.codes.join(", ")}`);
