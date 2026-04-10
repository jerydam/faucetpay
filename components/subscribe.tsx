"use client"
import React, { useState, createContext, useContext, useCallback } from "react"
import { BrowserProvider, Contract, parseEther } from "ethers"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import {
    ShieldCheck, Zap, CheckCircle2, Loader2, Sparkles,
    Infinity, BarChart3, Layers, Users, Globe, X
} from "lucide-react"

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app"
const COMPANY_WALLET = "0x97841b00B8Ad031FB30495eCeF2B2DbB6FCaCE30"

const STABLECOINS: Record<number, { address: string; decimals: number; symbol: string }> = {
    42220: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6,  symbol: "USDT" },
    1135:  { address: "0x05D032ac25d322df992303dCa074EE7392C117b9", decimals: 6,  symbol: "USDT" },
    42161: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6,  symbol: "USDT" },
    8453:  { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6,  symbol: "USDC" },
    56:    { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, symbol: "USDT" },
}

const PERKS = [
    { icon: <Infinity className="h-4 w-4" />,    label: "Unlimited Quests"          },
    { icon: <Zap className="h-4 w-4" />,          label: "Auto-Verify Socials"       },
    { icon: <Layers className="h-4 w-4" />,       label: "Multi-Stage Quests"        },
    { icon: <BarChart3 className="h-4 w-4" />,    label: "Admin Analytics Dashboard" },
    { icon: <Globe className="h-4 w-4" />,        label: "On-Chain Verification"     },
    { icon: <Users className="h-4 w-4" />,        label: "Funded Reward Pool"        },
]

// ─── Context ─────────────────────────────────────────────────────────────────

interface SubscriptionModalContextValue {
    openSubscriptionModal: (opts?: { onSuccess?: () => void }) => void
}

const SubscriptionModalContext = createContext<SubscriptionModalContextValue>({
    openSubscriptionModal: () => {},
})

export const useSubscriptionModal = () => useContext(SubscriptionModalContext)

// ─── Provider — wrap your layout with this once ───────────────────────────────

export function SubscriptionModalProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | undefined>()

    const openSubscriptionModal = useCallback((opts?: { onSuccess?: () => void }) => {
        setOnSuccessCallback(() => opts?.onSuccess)
        setOpen(true)
    }, [])

    return (
        <SubscriptionModalContext.Provider value={{ openSubscriptionModal }}>
            {children}
            <SubscriptionModal
                open={open}
                onOpenChange={setOpen}
                onSuccess={() => {
                    setOpen(false)
                    onSuccessCallback?.()
                }}
            />
        </SubscriptionModalContext.Provider>
    )
}

// ─── Standalone Modal — use directly if not using the provider ────────────────

interface SubscriptionModalProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    onSuccess?: () => void
    /** Optional: override wallet address (falls back to Privy user wallet) */
    walletAddress?: string
}

export function SubscriptionModal({ open, onOpenChange, onSuccess, walletAddress }: SubscriptionModalProps) {
    const { toast } = useToast()
    const { user: privyUser } = usePrivy()
    const { wallets } = useWallets()
    const activeWallet = wallets?.[0]
    const [isProcessing, setIsProcessing] = useState(false)
    const [step, setStep] = useState<'idle' | 'confirm' | 'processing' | 'done'>('idle')

    const userWalletAddress = walletAddress || activeWallet?.address || privyUser?.wallet?.address || ""


    const handleSubscribe = async () => {
        if (!userWalletAddress) {
            toast({ title: "Wallet not connected", variant: "destructive" })
            return
        }

        setIsProcessing(true)
        setStep('confirm')

    try {
        if (!activeWallet) throw new Error("No wallet connected.")
            const privyProvider = await activeWallet.getEthereumProvider()
            const ethersProvider = new BrowserProvider(privyProvider)
            const signer = await ethersProvider.getSigner()
            const userAddress = await signer.getAddress()
            const network = await ethersProvider.getNetwork()
            const currentChainId = Number(network.chainId)

            const stablecoin = STABLECOINS[currentChainId]
            if (!stablecoin) throw new Error(
                "Stablecoin payments not configured for this network. Please switch to Celo, Base, Arbitrum, BNB Chain, or Lisk."
            )

            const amountWei = parseEther("100") / BigInt(10 ** (18 - stablecoin.decimals))

            const ERC20_ABI = [
                "function transfer(address to, uint256 amount) public returns (bool)",
                "function balanceOf(address account) public view returns (uint256)"
            ]
            const tokenContract = new Contract(stablecoin.address, ERC20_ABI, signer)

            const balance = await tokenContract.balanceOf(userAddress)
            if (balance < amountWei) throw new Error(
                `Insufficient ${stablecoin.symbol} balance. You need $100 to subscribe.`
            )

            setStep('confirm')
            toast({ title: "Please confirm the $100 payment in your wallet..." })

            const tx = await tokenContract.transfer(COMPANY_WALLET, amountWei)

            setStep('processing')
            toast({ title: "Payment submitted. Waiting for confirmation..." })
            await tx.wait()

            toast({ title: "Activating your subscription..." })
            const res = await fetch(`${API_BASE_URL}/api/profile/subscribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    wallet_address: userWalletAddress.toLowerCase(),
                    tx_hash: tx.hash
                })
            })
            const data = await res.json()
            if (!data.success) throw new Error("Backend failed to activate subscription.")

            setStep('done')
            toast({ title: "🎉 Subscription Activated!", description: "You now have full access for 30 days." })

            setTimeout(() => {
                onSuccess?.()
                setStep('idle')
            }, 1800)

        } catch (error: any) {
            const msg = error.reason || error.shortMessage || error.message || "Payment failed"
            toast({ title: "Subscription failed", description: msg, variant: "destructive" })
            setStep('idle')
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) onOpenChange(v) }}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 border-0">

                {/* Gradient header */}
               <div className="relative bg-primary p-6 text-primary-foreground">
                     <button
                        onClick={() => !isProcessing && onOpenChange(false)}
                        className="absolute top-4 right-4 text-primary-foreground/60 hover:text-primary-foreground transition-colors"

                    >
                        <X className="h-4 w-4" />
                    </button>

                    <DialogHeader className="mb-3 space-y-0">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
                                <ShieldCheck className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div>
                                <DialogTitle className="text-primary-foreground text-lg font-bold leading-tight">
                                    FaucetDrops Pro
                                </DialogTitle>
                                <DialogDescription className="text-primary-foreground/70 text-xs">
                                    30-day access · All features unlocked
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex items-end gap-1 mt-4">
                        <span className="text-4xl font-black tracking-tight">$100</span>
                        <span className="text-primary-foreground/60 text-sm mb-1">/ 30 days</span>
                    </div>
                    <Badge className="mt-2 bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 text-[10px] hover:bg-primary-foreground/20">
                        <Sparkles className="h-2.5 w-2.5 mr-1" /> Paid in USDT · Any supported chain
                    </Badge>
                </div>

                {/* Perks + CTA */}
                <div className="p-5 bg-background space-y-4">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                        What you unlock
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                        {PERKS.map((perk, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/50"
                            >
                               <span className="shrink-0 text-primary">{perk.icon}</span>
                                <span className="text-xs font-medium text-foreground leading-tight">{perk.label}</span>
                            </div>
                        ))}
                    </div>

                    <p className="text-[11px] text-muted-foreground text-center">
                        Supported: Celo · Base · Arbitrum · BNB Chain · Lisk
                    </p>

                    {step === 'done' ? (
                        <div className="flex items-center justify-center gap-2 py-3 text-green-600 font-semibold">
                            <CheckCircle2 className="h-5 w-5" />
                            Subscription Activated!
                        </div>
                    ) : (
                        <Button
                            className="w-full font-bold h-11"
                            onClick={handleSubscribe}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {step === 'confirm' ? "Confirm in wallet..." : "Processing payment..."}
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                    Confirm Subscription
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}