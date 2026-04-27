// lib/viem-contracts.ts
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  parseUnits,
  keccak256,
  toBytes,
  encodeFunctionData,
  type Address,
  type Abi,
} from "viem";
import { celo } from "viem/chains";

export function getViemClients() {
  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(window.ethereum),
  });
  const publicClient = createPublicClient({
    chain: celo,
    transport: http("https://forno.celo.org"),
  });
  return { walletClient, publicClient };
}

export function deriveQuizId(code: string): `0x${string}` {
  return keccak256(toBytes(code));
}