"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Contract } from "ethers";
import {
  Droplets,
  PackageCheck,
  GraduationCap,
  ChevronRight,
  ArrowRight,
  Globe,
  CheckCircle2,
  User,
  ChartLine,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/hooks/use-wallet";
import { usePrivy } from "@privy-io/react-auth";
import Image from "next/image";
import { WalletConnectButton } from "@/components/wallet-connect";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme";
import { NotificationBell } from "@/components/notifications-provider";

// ─── Constants ────────────────────────────────────────────────────────────────

const POINTS_CONTRACT_ADDRESSES: Record<number, string> = {
  42220: "0xF8F6D74E61A0FC2dd2feCd41dE384ba2fbf91b9D",
  8453:  "0x42fcB7C4D4a36D772c430ee8C7d026f627365BcB",
  56:    "0x4C603fe32fe590D8A47B7f23b027dc24C2c762B1",
  1135:  "0x28B9DAB4Fd2CD9bF1A4773dB858e03Ee178AE075",
  42161: "0xEcb026D22f9aA7FD9Aa83B509834dB8Fd66B27F6",
};

const API_BASE_URL = "http://127.0.0.1:8000";

const POINTS_ABI = [
  "function claim(uint256 amount, uint256 timestamp, bytes signature) external",
  "function canClaim(address user) view returns (bool)",
];

const CAMPAIGNS = [
  {
    id: 1,
    icon: <Droplets className="h-4 w-4 text-blue-500" />,
    title: "Faucets",
    desc: "Smart token distribution with flexible access controls.",
    points: "100+ Faucets",
    path: "/faucet",
    bgImage: "/faucet-bg.png",
    cta: "Launch Faucet",
  },
  {
    id: 2,
    icon: <PackageCheck className="h-4 w-4 text-blue-500" />,
    title: "Quests",
    desc: "Engage users with interactive missions.",
    points: "20+ Quests",
    path: "https://app.faucetdrops.io/quest",
    bgImage: "/quest-bg.png",
    cta: "Launch Quest",
  },
  {
    id: 3,
    icon: <GraduationCap className="h-4 w-4 text-blue-500" />,
    title: "Quizzes",
    desc: "Educate and reward users through challenges.",
    points: "50+ Quizzes",
    path: "/quiz",
    bgImage: "/quiz-bg.png",
    cta: "Launch Quiz",
  },
];

// ─── Logo SVGs (unchanged from original) ─────────────────────────────────────

export const LayerZeroLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" className="fill-foreground" />
    <path d="M16.6 8.5L10.2 16.5H7.5L13.9 8.5H16.6Z" className="fill-background" />
    <path d="M7.5 7.5H10.2L11.5 9.1L8.8 9.1L7.5 7.5Z" className="fill-background" />
    <path d="M13.9 16.5H16.6L15.3 14.9L12.6 14.9L13.9 16.5Z" className="fill-background" />
  </svg>
);
export const ScrollLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" className="fill-accent dark:fill-orange-100/20" />
    <path d="M8 7C8 5.89543 8.89543 5 10 5H14C15.1046 5 16 5.89543 16 7V17C16 18.1046 15.1046 19 14 19H10C8.89543 19 8 18.1046 8 17V7Z" className="stroke-foreground" strokeWidth="1.5" />
    <path d="M12 8V10" className="stroke-foreground" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 14V16" className="stroke-foreground" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
export const StarkNetLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" className="fill-blue-900 dark:fill-blue-950" />
    <path d="M16.7 9.8C16.7 9.8 13.9 9.8 12 9.8C10.1 9.8 7.3 9.8 7.3 9.8C6.9 9.8 6.5 10.1 6.5 10.5C6.5 10.9 6.8 11.2 7.2 11.3L9.5 12.1L8.6 14.4C8.5 14.8 8.7 15.2 9.1 15.3C9.5 15.4 9.9 15.2 10 14.8L11.2 11.8L12 9.8L12.8 11.8L14 14.8C14.1 15.2 14.5 15.4 14.9 15.3C15.3 15.2 15.5 14.8 15.4 14.4L14.5 12.1L16.8 11.3C17.2 11.2 17.5 10.9 17.5 10.5C17.5 10.1 17.1 9.8 16.7 9.8Z" className="fill-blue-400" />
  </svg>
);
export const FuelLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="12" className="fill-primary" />
    <path d="M8 8H11V11H8V8Z" className="fill-primary-foreground" />
    <path d="M13 8H16V11H13V8Z" className="fill-primary-foreground" />
    <path d="M8 13H11V16H8V13Z" className="fill-primary-foreground/80" />
    <path d="M13 13H16V16H13V13Z" className="fill-primary-foreground/80" />
  </svg>
);
export const PendleLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" className="fill-foreground" />
    <path d="M8.5 7C8.5 7 11 7 12.5 7C14.9853 7 17 9.01472 17 11.5C17 13.9853 14.9853 16 12.5 16H10.5V11.5C10.5 10.3954 9.60457 9.5 8.5 9.5V7Z" fill="#589BFF" />
  </svg>
);
export const EthGlobalLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" className="fill-foreground" />
    <path d="M12 4.5L7.5 11.5L12 19.5L16.5 11.5L12 4.5Z" stroke="#627EEA" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M7.5 11.5H16.5" stroke="#627EEA" strokeWidth="1.5" />
    <path d="M12 11.5V4.5" stroke="#627EEA" strokeWidth="1.5" />
    <path d="M12 13V19.5" stroke="#627EEA" strokeWidth="1.5" />
  </svg>
);
export const NigeriaWeb3Logo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#008751" />
    <path d="M12 6V18" className="stroke-background" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 8L16 16" className="stroke-background" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 8L8 16" className="stroke-background" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
export const AfricaBlockchainLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#FBBF24" />
    <path d="M14 6C14 6 10 6 9 8C8 10 6 11 6 13C6 15 9 19 12 19C15 19 16 15 17 12C18 9 17 7 14 6Z" className="fill-background" />
  </svg>
);
export const ZKHackLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" className="fill-foreground" />
    <path d="M7 8H17L7 16H17" stroke="#00FFA3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const DeFiAfricaLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" className="fill-blue-900 dark:fill-blue-300" />
    <path d="M7 12H17" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7V17" stroke="currentColor" strokeWidth="2" />
    <rect x="9" y="9" width="6" height="6" stroke="currentColor" strokeWidth="2" />
  </svg>
);
export const Web3LadiesLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#EC4899" />
    <path d="M7 10L9.5 16L12 12L14.5 16L17 10" className="stroke-background" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const SolanaNigeriaLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#14F195" />
    <path d="M7 9L17 7" className="stroke-background dark:stroke-black" strokeWidth="2" strokeLinecap="round" />
    <path d="M7 13L17 11" className="stroke-background dark:stroke-black" strokeWidth="2" strokeLinecap="round" />
    <path d="M7 17L17 15" className="stroke-background dark:stroke-black" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
export const PolygonGuildLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#8247E5" />
    <path d="M15.4 12.6L13.8 11.7L12.2 12.6V14.4L13.8 15.3L15.4 14.4V12.6Z" className="fill-background" />
    <path d="M11.8 11.7L10.2 12.6V14.4L11.8 15.3V11.7Z" className="fill-background" />
    <path d="M15.4 9.9L13.8 9L12.2 9.9V11.7L13.8 12.6L15.4 11.7V9.9Z" className="fill-background" />
    <path d="M11.8 6.3L10.2 7.2V9L11.8 9.9V6.3Z" className="fill-background" />
    <path d="M10.2 9.9L8.6 9L7 9.9V11.7L8.6 12.6L10.2 11.7V9.9Z" className="fill-background" />
  </svg>
);
export const ChainlinkBuildersLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#375BD2" />
    <path d="M12 6L7 8.5V15.5L12 18L17 15.5V8.5L12 6Z" className="stroke-background" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M12 9.5V14.5" className="stroke-background" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
export const BaseEcosystemLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#0052FF" />
    <circle cx="12" cy="12" r="8" className="stroke-background" strokeWidth="3" />
  </svg>
);

// ─── Static data ──────────────────────────────────────────────────────────────

const NEW_SPACES = [
  { id: 1, name: "LayerZero",     tags: ["Infra", "Cross-chain"], quests: "3", funding: "$263M", followers: "180K", logo: LayerZeroLogo },
  { id: 2, name: "Scroll",        tags: ["ZK", "Layer2"],         quests: "2", funding: "$83M",  followers: "145K", logo: ScrollLogo },
  { id: 3, name: "StarkNet",      tags: ["ZK", "Infra"],          quests: "4", funding: "$282M", followers: "320K", logo: StarkNetLogo },
  { id: 4, name: "Fuel Network",  tags: ["Layer2", "Infra"],      quests: "1", funding: "$81M",  followers: "98K",  logo: FuelLogo },
  { id: 5, name: "Pendle Finance",tags: ["DeFi", "Yield"],        quests: "2", funding: "$11M",  followers: "110K", logo: PendleLogo },
];

const HOT_SPACES = [
  { rank: "1",  name: "ETH Global",            participation: "2.62K", verified: true,  logo: EthGlobalLogo },
  { rank: "2",  name: "Nigeria Web3 Community", participation: "2.41K", verified: true,  logo: NigeriaWeb3Logo },
  { rank: "3",  name: "Africa Blockchain Devs", participation: "2.29K",                  logo: AfricaBlockchainLogo },
  { rank: "4",  name: "ZK Hack",               participation: "2.11K", verified: true,  logo: ZKHackLogo },
  { rank: "5",  name: "DeFi Africa",           participation: "1.97K",                  logo: DeFiAfricaLogo },
  { rank: "6",  name: "Web3 Ladies",           participation: "1.84K", verified: true,  logo: Web3LadiesLogo },
  { rank: "7",  name: "Solana Nigeria",         participation: "1.76K",                  logo: SolanaNigeriaLogo },
  { rank: "8",  name: "Polygon Guild",          participation: "1.63K", verified: true,  logo: PolygonGuildLogo },
  { rank: "9",  name: "Chainlink Builders",     participation: "1.52K",                  logo: ChainlinkBuildersLogo },
  { rank: "10", name: "Base Ecosystem",         participation: "1.44K", verified: true,  logo: BaseEcosystemLogo },
];

// ─── Main client component ────────────────────────────────────────────────────

function HomeContent() {
  const { address, isConnected, signer, chainId } = useWallet();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, ready } = usePrivy();

  const [showScrollHint, setShowScrollHint] = useState(true);
  const [isClaiming, setIsClaiming]         = useState(false);
  const [dropBalance, setDropBalance]       = useState<number | null>(null);
  const [lastClaimAt, setLastClaimAt]       = useState<string | null>(null);
  const [countdown, setCountdown]           = useState<string>("");
  const [canClaim, setCanClaim]             = useState<boolean>(true);

  const hasPromptedLogin   = useRef(false);
  const hasTriggeredTx     = useRef(false);
  const hasToastedLoading  = useRef(false);


  // ── Fetch balance ────────────────────────────────────────────────────────────
  const fetchBalance = async () => {
    if (!address) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/droplist/dashboard/${address}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.total_points !== undefined) setDropBalance(data.total_points);
      if (data.last_claim_at) setLastClaimAt(data.last_claim_at);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    }
  };

  useEffect(() => { fetchBalance(); }, [address]);

  // ── Claim points ─────────────────────────────────────────────────────────────
  const handleClaimPoints = async () => {
    if (!canClaim) {
      toast.error(`Already claimed today. Come back in ${countdown}`);
      return;
    }
    if (!isConnected || !address || !signer || !chainId) {
      toast.warning("Please connect your wallet to claim points");
      return;
    }
    const contractAddress = POINTS_CONTRACT_ADDRESSES[chainId];
    if (!contractAddress) {
      toast.error("Points claiming is not supported on this network yet.");
      return;
    }

    try {
      const readContract = new Contract(contractAddress, POINTS_ABI, signer);
      const isEligible = await readContract.canClaim(address);
      if (!isEligible) {
        toast.error("You must wait 24 hours between claims.");
        setCanClaim(false);
        return;
      }
    } catch (err) {
      console.warn("Could not verify on-chain status, proceeding...", err);
    }

    const lockKey = `pending_claim_${address}`;
    const pendingTime = localStorage.getItem(lockKey);
    if (pendingTime && Date.now() - parseInt(pendingTime) < 120000) {
      toast.error("Claim already in progress. Please wait.");
      return;
    }

    setIsClaiming(true);
    localStorage.setItem(lockKey, Date.now().toString());

    try {
      toast.loading("Generating secure signature...", { id: "claim-tx" });
      const claimRes = await fetch(`${API_BASE_URL}/api/droplist/generate-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, chainId }),
      });
      const claimData = await claimRes.json();
      if (!claimRes.ok) throw new Error(claimData.detail || "Failed to generate signature");

      toast.loading("Please sign the transaction...", { id: "claim-tx" });
      const contract = new Contract(contractAddress, POINTS_ABI, signer);
      const sig = claimData.signature.startsWith("0x")
        ? claimData.signature
        : `0x${claimData.signature}`;
      const tx = await contract.claim(claimData.amount, claimData.timestamp, sig);

      toast.loading("Awaiting confirmation...", { id: "claim-tx" });
      const receipt = await tx.wait();

      toast.loading("Verifying block...", { id: "claim-tx" });
      const verifyRes = await fetch(`${API_BASE_URL}/api/droplist/verify-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: receipt.hash, chainId, walletAddress: address }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.detail || "Verification failed");

      await fetchBalance();
      toast.success("Successfully claimed Daily Drop Points!", { id: "claim-tx" });
      localStorage.removeItem(lockKey);
    } catch (error: any) {
      localStorage.removeItem(lockKey);
      const msg = error.reason || error.message || "Failed to claim points";
      if (msg.includes("already used") || msg.includes("Cooldown")) {
        toast.error("Already claimed your points for today.", { id: "claim-tx" });
        fetchBalance();
      } else {
        toast.error(msg, { id: "claim-tx" });
      }
    } finally {
      setIsClaiming(false);
    }
  };

  // ── Countdown timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lastClaimAt) { setCanClaim(true); return; }
    const update = () => {
      const diff = Date.now() - new Date(lastClaimAt).getTime();
      const cooldown = 24 * 60 * 60 * 1000;
      if (diff < cooldown) {
        setCanClaim(false);
        const rem = cooldown - diff;
        setCountdown(`${Math.floor(rem / 3600000)}h ${Math.floor((rem % 3600000) / 60000)}m`);
      } else {
        setCanClaim(true);
        setCountdown("");
      }
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [lastClaimAt]);

  // ── URL action trigger ───────────────────────────────────────────────────────
  useEffect(() => {
    const action = searchParams?.get("action");
    if (action === "claim-points" && !hasTriggeredTx.current) {
      if (!ready) {
        if (!hasToastedLoading.current) {
          hasToastedLoading.current = true;
          toast.loading("Preparing to claim points...", { id: "action-loading" });
        }
        return;
      }
      toast.dismiss("action-loading");
      if (!isConnected) {
        if (!hasPromptedLogin.current) {
          hasPromptedLogin.current = true;
          toast.info("Please sign in or connect your wallet to claim.");
          login();
        }
        return;
      }
      hasTriggeredTx.current = true;
      if (canClaim) handleClaimPoints();
      else toast.info(`Already claimed today. Come back in ${countdown}`);
      router.replace("/", { scroll: false });
    }
  }, [ready, searchParams, isConnected, address, login, router, canClaim, countdown]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollLeft > 20) setShowScrollHint(false);
  };

  return (
    <div className="min-h-screen text-foreground bg-background selection:bg-primary/30">

      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-[100] bg-background/90 backdrop-blur-md border-b border-border px-4 h-16 sm:h-20 flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <div className="relative w-28 sm:w-40 h-8 sm:h-10 transition-transform hover:scale-105 hidden dark:block">
            <Image src="/darklogo.png" alt="Logo" fill className="object-contain" priority />
          </div>
          <div className="relative w-28 sm:w-40 h-8 sm:h-10 transition-transform hover:scale-105 block dark:hidden">
            <Image src="/lightlogo.png" alt="Logo" fill className="object-contain" priority />
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <WalletConnectButton />
         <NotificationBell />
        </div>
      </nav>

      <main className="pt-24 sm:pt-32 pb-20 px-4 sm:px-6 max-w-[1400px] mx-auto space-y-16 sm:space-y-24">

        {/* ── Hero ── */}
        <div className="flex flex-col lg:flex-row gap-8 items-stretch">
          <div className="flex-1 w-full overflow-hidden">
            <h1 className="text-xl sm:text-xl lg:text-xl font-bold mb-6 tracking-tight leading-tight text-center lg:text-left">
              The all-in-one stack for your Web3 Growth,{" "}
              <br className="hidden sm:block" />
              Engagement and Reward Distribution.
            </h1>

            <div className="relative group">
              {showScrollHint && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="lg:hidden absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none"
                >
                  <div className="bg-primary/20 backdrop-blur-md border border-primary/50 p-3 rounded-full animate-bounce">
                    <ArrowRight size={20} className="text-primary" />
                  </div>
                </motion.div>
              )}
              <div
                onScroll={handleScroll}
                className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory"
              >
                {CAMPAIGNS.map((c) => (
                  <Link href={c.path} key={c.id}>
                    <div className="min-w-[85vw] sm:min-w-[400px] h-64 sm:h-72 rounded-2xl p-6 sm:p-8 bg-card bg-gradient-to-br from-card via-card to-accent/30 dark:to-accent/10 border border-border flex flex-col justify-between snap-center cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-primary/50 overflow-hidden relative group">
                      <div className="absolute inset-0 z-0 opacity-[0.15] dark:opacity-20 group-hover:opacity-25 transition-opacity">
                        <Image src={c.bgImage} alt="pattern" fill className="object-cover" />
                      </div>
                      <div className="relative z-10">
                        <div className="mb-2">{c.icon}</div>
                        <h3 className="text-xl sm:text-2xl font-bold mt-2 leading-tight">{c.title}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-2 line-clamp-2">{c.desc}</p>
                      </div>
                      <div className="flex justify-between items-end relative z-10">
                        <button className="px-4 sm:px-6 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded-lg font-bold text-xs sm:text-sm transition-colors shadow-md">
                          {c.cta}
                        </button>
                        <div className="bg-accent/50 dark:bg-accent px-3 py-1 rounded-md text-[10px] sm:text-xs font-mono text-accent-foreground border border-border/50">
                          {c.points}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

        </div>

       
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  );
}