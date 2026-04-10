"use client"

import type React from "react"
import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useWallet } from "@/hooks/use-wallet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Header } from "@/components/header"
import {
    isWhitelisted,
    getAllAdmins,
} from "@/lib/faucet"
import { formatUnits, type BrowserProvider, JsonRpcProvider } from "ethers"
import { Checkbox } from "@/components/ui/checkbox"
import { claimViaBackend, claimNoCodeViaBackend, claimCustomViaBackend } from "@/lib/backend-service"
import { useNetwork } from "@/hooks/use-network"
import LoadingPage from "@/components/loading"
import FaucetAdminView from "@/components/faucetView/FaucetAdminView"
import FaucetUserView from "@/components/faucetView/FaucetUserView"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
  resolveFaucetParam,
  getFaucetByAddress,
  type FaucetDetailRow,
  buildFaucetSlug,
} from "@/lib/faucet-slug"

// ── Constants ─────────────────────────────────────────────────────────────────

type FaucetType = "dropcode" | "droplist" | "custom"

interface SocialMediaLink {
    platform: string
    url: string
    handle: string
    action: string
}

const DEFAULT_FAUCET_IMAGE = "/default.jpeg"
const FACTORY_OWNER_ADDRESS = "0x9fBC2A0de6e5C5Fd96e8D11541608f5F328C0785"

const FIXED_TWEET_PREFIX = "I just dripped {amount} {token} from @FaucetDrops on {network}."
const DEFAULT_X_POST_TEMPLATE = "Drip created by {@yourhandle} for {#the_hashtag}."
const CONSTANT_X_POST = "I just dripped {amount} {token} from @FaucetDrops on {network}.Verify Drop 💧: {explorer}"

// ── Small helpers ─────────────────────────────────────────────────────────────

const getDefaultFaucetDescription = (networkName: string, ownerAddress: string) =>
    `This is a faucet on ${networkName} by ${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}`

const isTemplateCustomized = (template: string): boolean => {
    if (!template?.trim() || template === DEFAULT_X_POST_TEMPLATE) return false
    return !template.includes("{@handle}") || !template.includes("{#hashtag}")
}

function rowToFaucetDetails(row: FaucetDetailRow) {
    return {
        name: row.faucet_name,
        owner: row.owner_address,
        token: row.token_address,
        tokenSymbol: row.token_symbol,
        tokenDecimals: row.token_decimals,
        isEther: row.is_ether,
        balance: BigInt(row.balance ?? "0"),
        claimAmount: BigInt(row.claim_amount ?? "0"),
        startTime: row.start_time ? BigInt(row.start_time) : null,
        endTime: row.end_time ? BigInt(row.end_time) : null,
        isClaimActive: row.is_claim_active,
        isPaused: row.is_paused,
        backendMode: row.use_backend,
        hasClaimed: false, 
        description: row.description,
        imageUrl: row.image_url || DEFAULT_FAUCET_IMAGE,
        factoryType: row.factory_type,
        customXPostTemplate: "", 
        _supabaseRow: row,
    }
}

// ── Remote helpers ───────────────────────────────────────────────────────────
async function checkIsClaimActiveOnchain(
    provider: any,
    faucetAddress: string
): Promise<boolean | null> {
    try {
        const { Contract } = await import("ethers")
        // Minimal ABI to read the active status
        const abi = ["function isClaimActive() view returns (bool)"]
        const contract = new Contract(faucetAddress, abi, provider)
        return await contract.isClaimActive()
    } catch {
        return null; // Fallback to DB value if RPC fails
    }
}

async function checkIsAdmin(
    provider: any,
    faucetAddress: string,
    userAddress: string,
    type: FaucetType
): Promise<boolean> {
    if (userAddress.toLowerCase() === FACTORY_OWNER_ADDRESS.toLowerCase()) return true
    try {
        const { Contract } = await import("ethers")
        const abiMap: Record<FaucetType, () => Promise<any[]>> = {
            dropcode: () => import("@/lib/abis").then((m) => m.FAUCET_ABI_DROPCODE),
            droplist: () => import("@/lib/abis").then((m) => m.FAUCET_ABI_DROPLIST),
            custom:   () => import("@/lib/abis").then((m) => m.FAUCET_ABI_CUSTOM),
        }
        const abi = await abiMap[type]()
        const contract = new Contract(faucetAddress, abi, provider)
        return await contract.isAdmin(userAddress)
    } catch {
        return false
    }
}

async function getUserCustomClaimAmount(
    provider: any,
    userAddress: string,
    faucetAddress: string,
    tokenDecimals: number
): Promise<{ amount: bigint; hasCustom: boolean }> {
    try {
        const { FAUCET_ABI_CUSTOM } = await import("@/lib/abis")
        const { Contract } = await import("ethers")
        const contract = new Contract(faucetAddress, FAUCET_ABI_CUSTOM, provider)
        const hasCustom = await contract.hasCustomClaimAmount(userAddress)
        if (hasCustom) {
            const amount = await contract.getCustomClaimAmount(userAddress)
            return { amount, hasCustom: true }
        }
        return { amount: BigInt(0), hasCustom: false }
    } catch {
        return { amount: BigInt(0), hasCustom: false }
    }
}

async function loadSocialMediaLinks(faucetAddress: string): Promise<SocialMediaLink[]> {
    try {
        const res = await fetch(`https://identical-vivi-faucetdrops-41e9c56b.koyeb.app/faucet-tasks/${faucetAddress}`)
        if (!res.ok) return []
        const result = await res.json()
        if (!Array.isArray(result.tasks)) return []
        return result.tasks.map((t: any) => ({
            platform: t.platform || "link",
            url: t.url,
            handle: t.handle,
            action: t.action || "check",
        }))
    } catch {
        return []
    }
}

async function loadCustomXPostTemplate(faucetAddress: string): Promise<string> {
    try {
        const res = await fetch(`https://identical-vivi-faucetdrops-41e9c56b.koyeb.app/faucet-x-template/${faucetAddress}`)
        if (!res.ok) return DEFAULT_X_POST_TEMPLATE
        const result = await res.json()
        return result.template || DEFAULT_X_POST_TEMPLATE
    } catch {
        return DEFAULT_X_POST_TEMPLATE
    }
}

async function saveAdminPopupPreference(userAddr: string, faucetAddr: string, dontShow: boolean) {
    try {
        const res = await fetch("https://identical-vivi-faucetdrops-41e9c56b.koyeb.app/admin-popup-preference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userAddress: userAddr, faucetAddress: faucetAddr, dontShowAgain: dontShow }),
        })
        return res.ok ? (await res.json()).success : false
    } catch { return false }
}

async function getAdminPopupPreference(userAddr: string, faucetAddr: string): Promise<boolean> {
    try {
        const res = await fetch(
            `https://identical-vivi-faucetdrops-41e9c56b.koyeb.app/admin-popup-preference?userAddress=${encodeURIComponent(userAddr)}&faucetAddress=${encodeURIComponent(faucetAddr)}`
        )
        return res.ok ? (await res.json()).dontShowAgain ?? false : false
    } catch { return false }
}

async function checkHasClaimed(
    provider: JsonRpcProvider,
    faucetAddress: string,
    userAddress: string,
    faucetType: FaucetType
): Promise<boolean> {
    try {
        const { Contract } = await import("ethers")
        const abiStub = [{
            inputs: [{ internalType: "address", name: "", type: "address" }],
            name: "hasClaimed",
            outputs: [{ internalType: "bool", name: "", type: "bool" }],
            stateMutability: "view",
            type: "function",
        }]
        const contract = new Contract(faucetAddress, abiStub, provider)
        return await contract.hasClaimed(userAddress)
    } catch {
        return false
    }
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FaucetDetails() {
    const { address: rawParam } = useParams<{ address: string }>()
    const searchParams  = useSearchParams()
    const networkId     = searchParams.get("networkId")
    const [hasAutoSynced, setHasAutoSynced] = useState(false);
    const router                        = useRouter()
    const { address, chainId, isConnected, provider } = useWallet()
    const { networks }                  = useNetwork()

    // ── Core state ─────────────────────────────────────────────────────────
    const [faucetRow, setFaucetRow]     = useState<FaucetDetailRow | null>(null)
    const [faucetDetails, setFaucetDetails] = useState<any>(null)
    const [faucetType, setFaucetType]   = useState<FaucetType | null>(null)
    const [faucetAddress, setFaucetAddress] = useState<string>("")
    const [loading, setLoading]         = useState(true)
    const [selectedNetwork, setSelectedNetwork] = useState<any>(null)

    // ── User state ─────────────────────────────────────────────────────────
    const [userIsAdmin, setUserIsAdmin]                 = useState(false)
    const [hasClaimed, setHasClaimed]                   = useState(false)
    const [userIsWhitelisted, setUserIsWhitelisted]     = useState(false)
    const [userCustomClaimAmount, setUserCustomClaimAmount] = useState<bigint>(BigInt(0))
    const [hasCustomAmount, setHasCustomAmount]         = useState(false)
    const [secretCode, setSecretCode]                   = useState("")
    const [usernames, setUsernames]                     = useState<Record<string, string>>({})
    const [verificationStates, setVerificationStates]   = useState<Record<string, boolean>>({})
    const [isVerifying, setIsVerifying]                 = useState(false)
    const [showFollowDialog, setShowFollowDialog]       = useState(false)
    const [showVerificationDialog, setShowVerificationDialog] = useState(false)
    const [showClaimPopup, setShowClaimPopup]           = useState(false)
    const [txHash, setTxHash]                           = useState<string | null>(null)
    const [hasAttemptedVerification, setHasAttemptedVerification] = useState(false)

    // ── Admin state ────────────────────────────────────────────────────────
    const [adminList, setAdminList]                     = useState<string[]>([])
    const [backendMode, setBackendMode]                 = useState(true)
    const [tokenSymbol, setTokenSymbol]                 = useState("ETH")
    const [tokenDecimals, setTokenDecimals]             = useState(18)
    const [faucetMetadata, setFaucetMetadata]           = useState<{ description?: string; imageUrl?: string }>({})
    const [customXPostTemplate, setCustomXPostTemplate] = useState(DEFAULT_X_POST_TEMPLATE)
    const [dynamicTasks, setDynamicTasks]               = useState<SocialMediaLink[]>([])
    const [transactions, setTransactions]               = useState<any[]>([])
    const [showAdminPopup, setShowAdminPopup]           = useState(false)
    const [dontShowAdminPopupAgain, setDontShowAdminPopupAgain] = useState(false)
    const [newSocialLinks, setNewSocialLinks]           = useState<SocialMediaLink[]>([])
    const [claimAmount, setClaimAmount]                 = useState("0")
    const [startTime, setStartTime]                     = useState("")
    const [endTime, setEndTime]                         = useState("")

    // ── Derived ────────────────────────────────────────────────────────────
    const isOwner = address && faucetDetails?.owner &&
        address.toLowerCase() === faucetDetails.owner.toLowerCase()
    const isBackendAddress = address &&
        address.toLowerCase() === FACTORY_OWNER_ADDRESS.toLowerCase()
    const canAccessAdminControls = isOwner || userIsAdmin || isBackendAddress

    const getTaskKey = (task: SocialMediaLink) => task.platform
    const isSecretCodeValid = secretCode.length === 6 && /^[A-Z0-9]{6}$/.test(secretCode)
    const allAccountsVerified =
        dynamicTasks.length === 0 ? true : dynamicTasks.every((t) => verificationStates[getTaskKey(t)])

    // --- FORCE SYNC HELPER ---
    const triggerForceSync = async (addressToSync: string) => {
        try {
            console.log(`Triggering force sync for ${addressToSync}...`);
            const res = await fetch(`https://faucetdrops-indexer.onrender.com/force-sync-faucet/${addressToSync}`, {
                method: "POST",
            });
            const data = await res.json();
            if (!data.success) {
                console.warn("Force sync issue:", data.error);
            } else {
                console.log("Force sync successful!");
            }
        } catch (err) {
            console.error("Network error during force sync:", err);
        }
    };

    const checkNetwork = useCallback(
        (skipToast = false): boolean => {
            if (!chainId) {
                if (!skipToast) toast.warning("Network not detected. Please ensure your wallet is connected.")
                return false
            }
            const targetId = faucetRow?.chain_id ?? Number(networkId)
            if (targetId && targetId !== chainId) {
                if (!skipToast) toast.warning("Wrong Network — switch to the correct network.")
                return false
            }
            return true
        },
        [chainId, networkId, faucetRow]
    )

    const loadUserSpecificData = useCallback(async (
        row: FaucetDetailRow,
        type: FaucetType,
        net: any
    ) => {
        if (!address || !net) return

        try {
            const safeRpc = Array.isArray(net.rpcUrl) ? net.rpcUrl[0] : net.rpcUrl
            const p = new JsonRpcProvider(safeRpc)

            const claimed = await checkHasClaimed(p, row.faucet_address, address, type)
            setHasClaimed(claimed)

            if (type === "droplist") {
                const wl = await isWhitelisted(p, row.faucet_address, address, type)
                setUserIsWhitelisted(wl)
            }
            if (type === "custom") {
                const ci = await getUserCustomClaimAmount(p, address, row.faucet_address, row.token_decimals)
                setUserCustomClaimAmount(ci.amount)
                setHasCustomAmount(ci.hasCustom)
            }

            const isAdmin = await checkIsAdmin(p, row.faucet_address, address, type)
            setUserIsAdmin(isAdmin)

            if (isAdmin || address.toLowerCase() === row.owner_address.toLowerCase()) {
                const dontShow = await getAdminPopupPreference(address, row.faucet_address)
                if (!dontShow) setShowAdminPopup(true)
            }

            const admins = await getAllAdmins(p, row.faucet_address, type)
            const all = [...admins]
            if (row.owner_address && !all.some((a) => a.toLowerCase() === row.owner_address.toLowerCase()))
                all.unshift(row.owner_address)
            if (!all.some((a) => a.toLowerCase() === FACTORY_OWNER_ADDRESS.toLowerCase()))
                all.push(FACTORY_OWNER_ADDRESS)
            setAdminList(all)

        } catch (err) {
            console.warn("loadUserSpecificData error:", err)
        }
    }, [address])

    
    const resolveAndLoad = useCallback(async () => {
      if (!rawParam) { setLoading(false); return }

      setLoading(true)
      try {
        let row: FaucetDetailRow | null = null
        const MAX_ATTEMPTS = 5
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 800 * attempt))
          row = await resolveFaucetParam(rawParam, networkId ? Number(networkId) : undefined)
          if (row) break
        }

        if (row) {
          const canonicalSlug = row.slug || buildFaucetSlug(row.faucet_name, row.faucet_address)
          if (rawParam !== canonicalSlug) {
            router.replace(`/faucet/${canonicalSlug}${networkId ? `?networkId=${networkId}` : ""}`)
          }

          setFaucetRow(row)
          setFaucetAddress(row.faucet_address)

          // DropCode Normalization Fix
          const rawType = (row.factory_type || "").toLowerCase()
          const isDropCode = rawType === "dropcode" || (rawType === "open" && row.use_backend === true)
          const normalizedType: FaucetType = isDropCode ? "dropcode" : rawType === "droplist" ? "droplist" : "custom"
          const actualBackendMode = isDropCode ? true : (row.use_backend ?? false)

          setFaucetType(normalizedType)
          setBackendMode(actualBackendMode) 

          const details = rowToFaucetDetails(row)
          details.backendMode = actualBackendMode

          const net = networks.find((n) => n.chainId === row!.chain_id) ?? null
          setSelectedNetwork(net)

          // 👇 NEW: Fetch live onchain status and overwrite the DB value
          if (net) {
              try {
                  const safeRpc = Array.isArray(net.rpcUrl) ? net.rpcUrl[0] : net.rpcUrl
                  const p = new JsonRpcProvider(safeRpc)
                  const liveStatus = await checkIsClaimActiveOnchain(p, row.faucet_address)
                  if (liveStatus !== null) {
                      details.isClaimActive = liveStatus
                  }
              } catch (err) {
                  console.warn("Failed to fetch live isClaimActive, using DB value.")
              }
          }
          const [template, tasks] = await Promise.all([
            loadCustomXPostTemplate(row.faucet_address),
            loadSocialMediaLinks(row.faucet_address),
          ])

          setFaucetDetails({ ...details, customXPostTemplate: template })
          setTokenSymbol(row.token_symbol)
          setTokenDecimals(row.token_decimals)
          setCustomXPostTemplate(template || DEFAULT_X_POST_TEMPLATE)
          setFaucetMetadata({
            description: row.description || getDefaultFaucetDescription(row.network_name, row.owner_address),
            imageUrl: row.image_url || "/default.jpeg",
          })
          setDynamicTasks(tasks)

          
          setSelectedNetwork(net)
          await loadUserSpecificData(row, normalizedType, net)

          // Background Force Sync on page load (so user gets freshest data)
          triggerForceSync(row.faucet_address);

        } else {
          toast.error("Faucet not found.")
          router.push("/faucet")
        }
      } catch (err) {
        console.error("resolveAndLoad failed:", err)
        toast.error("Error loading faucet details.")
      } finally {
        setLoading(false)
      }
    }, [rawParam, networkId, networks, address, router, loadUserSpecificData]) 


    const refreshFaucetDetails = useCallback(async () => {
        if (!faucetAddress || !selectedNetwork) return
        try {
            // 1. FORCE BACKEND SYNC FIRST BEFORE FETCHING
            await triggerForceSync(faucetAddress);

            // 2. FETCH FRESH DATA
            const row = await getFaucetByAddress(faucetAddress, selectedNetwork.chainId)
            
            if (row) {
                setFaucetRow(row)

                // DropCode Normalization Fix
                const rawType = (row.factory_type || "").toLowerCase()
                const isDropCode = rawType === "dropcode" || (rawType === "open" && row.use_backend === true)
                const actualBackendMode = isDropCode ? true : (row.use_backend ?? false)
                const normalizedType: FaucetType = isDropCode ? "dropcode" : rawType === "droplist" ? "droplist" : "custom"

                const details = rowToFaucetDetails(row)
                details.backendMode = actualBackendMode
                try {
                    const safeRpc = Array.isArray(selectedNetwork.rpcUrl) ? selectedNetwork.rpcUrl[0] : selectedNetwork.rpcUrl
                    const p = new JsonRpcProvider(safeRpc)
                    const liveStatus = await checkIsClaimActiveOnchain(p, faucetAddress)
                    if (liveStatus !== null) {
                        details.isClaimActive = liveStatus
                    }
                } catch (err) {
                    console.warn("Failed to fetch live isClaimActive, using DB value.")
                }
                const template = await loadCustomXPostTemplate(faucetAddress)
                setCustomXPostTemplate(template)
                setFaucetDetails({ ...details, customXPostTemplate: template })
                setTokenSymbol(row.token_symbol)
                setTokenDecimals(row.token_decimals)
                setBackendMode(actualBackendMode)
                setFaucetType(normalizedType)

                setFaucetMetadata({
                    description: row.description || getDefaultFaucetDescription(row.network_name, row.owner_address),
                    imageUrl: row.image_url || "/default.jpeg",
                })
                if (row.claim_amount)
                    setClaimAmount(formatUnits(BigInt(row.claim_amount), row.token_decimals))
                if (row.start_time)
                    setStartTime(new Date(row.start_time * 1000).toISOString().slice(0, 16))
                if (row.end_time)
                    setEndTime(new Date(row.end_time * 1000).toISOString().slice(0, 16))
                
                await loadUserSpecificData(row, normalizedType, selectedNetwork)
            }
        } catch (err) {
            console.warn("refreshFaucetDetails error:", err)
        }
    }, [faucetAddress, selectedNetwork, loadUserSpecificData])

    // ── Effects ────────────────────────────────────────────────────────────

useEffect(() => { resolveAndLoad() }, [rawParam, networkId])

// 👇 ADD THIS NEW EFFECT 👇
useEffect(() => {
    // If we don't have details, it's already active, or we already synced, do nothing
    if (!faucetDetails || faucetDetails.isClaimActive || hasAutoSynced) {
        return;
    }

    // Convert startTime to milliseconds
    const startTimeMs = Number(faucetDetails.startTime) * 1000;
    if (startTimeMs === 0) return;

    const timer = setInterval(() => {
        const now = Date.now();
        if (now >= startTimeMs) {
            console.log("⏰ Start time reached! Triggering auto-sync...");
            setHasAutoSynced(true); // Lock it so it only fires once
            clearInterval(timer);
            
            
            refreshFaucetDetails(); 
        }
    }, 1000);

    return () => clearInterval(timer);
}, [faucetDetails, hasAutoSynced, refreshFaucetDetails]);

    // ── Claim handler ──────────────────────────────────────────────────────

    // Replace handleBackendClaim — remove setShowClaimPopup(true) from inside it,
// and let the effect below handle opening the popup once txHash is confirmed set.
async function handleBackendClaim(): Promise<void> {
  if (!isConnected || !address || !faucetDetails) {
    toast.warning("Wallet not connected");
    return;
  }
  if (!checkNetwork()) return;
  if (
    faucetType === "dropcode" &&
    backendMode &&
    !isSecretCodeValid
  ) {
    toast.error("Invalid Drop code — 6 alphanumeric characters required");
    return;
  }
  if (faucetType === "droplist" && !userIsWhitelisted) {
    toast.error("Not Drop-listed");
    return;
  }
  if (faucetType === "custom" && !hasCustomAmount) {
    toast.error("No Custom Allocation");
    return;
  }
  if (!allAccountsVerified) {
    toast.error("Please complete all required tasks first");
    return;
  }

  try {
    setIsVerifying(true);
    const prov = provider as BrowserProvider;
    let result: any;

    if (faucetType === "custom") {
      result = await claimCustomViaBackend(address, faucetAddress, prov);
    } else if (faucetType === "dropcode" && backendMode) {
      result = await claimViaBackend(address, faucetAddress, prov, secretCode);
    } else {
      result = await claimNoCodeViaBackend(address, faucetAddress, prov);
    }

    // Set txHash first — the useEffect below will open the popup
    // only after txHash is confirmed in state, ensuring generateXPostContent
    // has the hash available when the share button is pressed.
    setTxHash(result.txHash);

    const claimedAmt =
      faucetType === "custom" && hasCustomAmount
        ? formatUnits(userCustomClaimAmount, tokenDecimals)
        : faucetDetails.claimAmount
        ? formatUnits(faucetDetails.claimAmount, tokenDecimals)
        : "tokens";

    toast.success(`You have dripped ${claimedAmt} ${tokenSymbol}.`);
    setSecretCode("");
    await refreshFaucetDetails();
  } catch (err: any) {
    toast.error(err.message);
  } finally {
    setIsVerifying(false);
  }
}

// Add this effect directly below handleBackendClaim.
// Opens the success popup only after txHash has been written to state,
// preventing generateXPostContent from seeing a null hash.
useEffect(() => {
  if (txHash) {
    setShowClaimPopup(true);
  }
}, [txHash]);

// Updated generateXPostContent — produces an empty string for {explorer}
// when txHash is not yet available, rather than the misleading fallback text.
const generateXPostContent = (amount: string): string => {
  const isEmpty = !customXPostTemplate?.trim();
  const isDefault = customXPostTemplate === DEFAULT_X_POST_TEMPLATE;
  const template =
    isEmpty || isDefault
      ? CONSTANT_X_POST
      : `${FIXED_TWEET_PREFIX} ${customXPostTemplate}`;

  let baseUrl = Array.isArray(selectedNetwork?.blockExplorerUrls)
    ? selectedNetwork.blockExplorerUrls[0]
    : selectedNetwork?.blockExplorerUrls;
  if (baseUrl?.endsWith("/")) baseUrl = baseUrl.slice(0, -1);

  // Only produce the explorer link when both txHash and baseUrl are present.
  // Fall back to an empty string so the post doesn't include broken placeholder text.
  const explorerLink =
    txHash && baseUrl ? `${baseUrl}/tx/${txHash}` : "";

  return template
    .replace(/\{amount\}/g, amount)
    .replace(/\{token\}/g, tokenSymbol)
    .replace(/\{network\}/g, selectedNetwork?.name || "the network")
    .replace(/\{faucet\}/g, faucetDetails?.name || "this faucet")
    .replace(/\{explorer\}/g, explorerLink)
    .replace(/\{@handle\}/g, "")
    .replace(/\{#hashtag\}/g, "")
    .trim();
};

    // ── Verification handler ───────────────────────────────────────────────

    const handleVerifyAllTasks = async (): Promise<void> => {
        const allFilled = dynamicTasks.every(
            (t) => usernames[getTaskKey(t)]?.trim().length > 0
        )
        if (!allFilled) { toast.error("Please enter usernames for all required tasks."); return }

        setIsVerifying(true)
        setShowVerificationDialog(true)

        setTimeout(() => {
            if (!hasAttemptedVerification) {
                setIsVerifying(false)
                setShowVerificationDialog(false)
                setHasAttemptedVerification(true)
                toast.error("Can't verify. Please complete the tasks and try again.")
            } else {
                const next: Record<string, boolean> = {}
                dynamicTasks.forEach((t) => { next[getTaskKey(t)] = true })
                setVerificationStates(next)
                setIsVerifying(false)
                toast.success("All tasks verified!")
                setTimeout(() => {
                    setShowVerificationDialog(false)
                    setShowFollowDialog(false)
                }, 2000)
            }
        }, 3000)
    }

   

    // ── Admin popup ────────────────────────────────────────────────────────

    const handleCloseAdminPopup = async (): Promise<void> => {
        if (dontShowAdminPopupAgain && faucetAddress && address) {
            const saved = await saveAdminPopupPreference(address, faucetAddress, true)
            if (saved) toast.success("Preference saved.")
        }
        setShowAdminPopup(false)
        setDontShowAdminPopupAgain(false)
    }

    const handleFollowAll = (): void => {
        if (dynamicTasks.length === 0) {
            toast.error("This faucet does not require social media verification.")
            return
        }
        setShowFollowDialog(true)
    }

    // ── Render ─────────────────────────────────────────────────────────────

    if (loading) return <LoadingPage />

    if (!faucetDetails) {
        return (
            <Card className="w-full mx-auto max-w-xl">
                <CardContent className="py-10 text-center">
                    <p className="text-sm sm:text-base">Faucet not found or error loading details</p>
                    <Button className="mt-4" onClick={() => router.push("/")}>
                        Return to Home
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="flex flex-col gap-6 sm:gap-8 max-w-3xl sm:max-w-4xl mx-auto">
                    <Header pageTitle="Faucet Details" />

                    {canAccessAdminControls ? (
                        <FaucetAdminView
                            faucetAddress={faucetAddress}
                            faucetDetails={faucetDetails}
                            faucetType={faucetType}
                            tokenSymbol={tokenSymbol}
                            tokenDecimals={tokenDecimals}
                            selectedNetwork={selectedNetwork}
                            adminList={adminList}
                            isOwner={isOwner}
                            backendMode={backendMode}
                            canAccessAdminControls={canAccessAdminControls}
                            loadFaucetDetails={refreshFaucetDetails}
                            checkNetwork={checkNetwork}
                            dynamicTasks={dynamicTasks}
                            newSocialLinks={newSocialLinks}
                            setNewSocialLinks={setNewSocialLinks}
                            customXPostTemplate={customXPostTemplate}
                            setCustomXPostTemplate={setCustomXPostTemplate}
                            setTransactions={setTransactions}
                            transactions={transactions}
                            address={address}
                            chainId={chainId}
                            provider={provider}
                            router={router}
                            faucetMetadata={faucetMetadata}
                        />
                    ) : (
                        <FaucetUserView
                            faucetAddress={faucetAddress}
                            faucetDetails={faucetDetails}
                            faucetType={faucetType}
                            tokenSymbol={tokenSymbol}
                            tokenDecimals={tokenDecimals}
                            selectedNetwork={selectedNetwork}
                            address={address}
                            isConnected={isConnected}
                            hasClaimed={hasClaimed}
                            userIsWhitelisted={userIsWhitelisted}
                            hasCustomAmount={hasCustomAmount}
                            userCustomClaimAmount={userCustomClaimAmount}
                            dynamicTasks={dynamicTasks}
                            allAccountsVerified={allAccountsVerified}
                            secretCode={secretCode}
                            setSecretCode={setSecretCode}
                            usernames={usernames}
                            setUsernames={setUsernames}
                            verificationStates={verificationStates}
                            setVerificationStates={setVerificationStates}
                            isVerifying={isVerifying}
                            faucetMetadata={faucetMetadata}
                            customXPostTemplate={customXPostTemplate}
                            handleBackendClaim={handleBackendClaim}
                            handleFollowAll={handleFollowAll}
                            generateXPostContent={generateXPostContent}
                            txHash={txHash}
                            showFollowDialog={showFollowDialog}
                            setShowFollowDialog={setShowFollowDialog}
                            showVerificationDialog={showVerificationDialog}
                            setShowVerificationDialog={setShowVerificationDialog}
                            showClaimPopup={showClaimPopup}
                            setShowClaimPopup={setShowClaimPopup}
                            handleVerifyAllTasks={handleVerifyAllTasks}
                        />
                    )}
                </div>
            </div>

            <Dialog open={showAdminPopup} onOpenChange={setShowAdminPopup}>
                <DialogContent className="w-11/12 max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg sm:text-xl">Admin Controls Guide</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">
                            Learn how to manage your {faucetType || "unknown"} faucet as an admin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <h3 className="text-sm sm:text-base font-semibold">Admin Privileges</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                As an admin, you can manage this {faucetType || "unknown"} faucet:
                            </p>
                            <ul className="list-disc pl-5 text-xs sm:text-sm text-muted-foreground space-y-1">
                                <li><strong>Fund/Withdraw:</strong> Manage faucet balance.</li>
                                <li><strong>Parameters:</strong> Set claim amount, timing, and tasks.</li>
                                {faucetType === "droplist" && <li><strong>Drop-list:</strong> Add or remove addresses.</li>}
                                {faucetType === "custom" && <li><strong>Custom:</strong> Upload CSV for custom allocations.</li>}
                                <li><strong>Admin Power:</strong> Manage admins and reset claims.</li>
                                <li><strong>Activity Log:</strong> View transaction history.</li>
                            </ul>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="dont-show-again"
                                checked={dontShowAdminPopupAgain}
                                onCheckedChange={(c) => setDontShowAdminPopupAgain(c === true)}
                            />
                            <Label htmlFor="dont-show-again" className="text-xs sm:text-sm">
                                Don't show this again for this faucet
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCloseAdminPopup} className="text-xs sm:text-sm w-full">
                            Got It
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    )
}