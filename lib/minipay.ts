// lib/minipay.ts
import { toast } from "sonner";

/** MiniPay's native top-up screen. Optional ?tokens= narrows which stablecoins are offered. */
export const MINIPAY_ADD_CASH_URL = "https://link.minipay.xyz/add_cash?tokens=USDm,USDC,USDT";

export function isMiniPay(): boolean {
  return typeof window !== "undefined" && !!(window.ethereum as any)?.isMiniPay;
}

export function openAddCash() {
  if (typeof window === "undefined") return;
  window.location.href = MINIPAY_ADD_CASH_URL;
}

export function isInsufficientBalanceMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("insufficient balance") || m.includes("insufficient token balance") || m.includes("insufficient funds");
}

/**
 * Shows an on-chain error toast. Inside MiniPay, an insufficient-balance
 * error gets a one-tap "Deposit" action that opens MiniPay's Add Cash
 * deeplink, instead of leaving the user stuck on a generic error.
 */
export function showOnchainErrorToast(message: string, options: Record<string, any> = {}) {
  if (isMiniPay() && isInsufficientBalanceMessage(message)) {
    toast.error(message, {
      ...options,
      action: {
        label: "Deposit",
        onClick: openAddCash,
      },
    });
    return;
  }
  toast.error(message, options);
}
