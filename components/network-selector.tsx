"use client"

import { useNetwork, type Network } from "@/hooks/use-network"
import { useWallet } from "@/components/wallet-provider" 
import { usePrivy } from '@privy-io/react-auth'
import { Network as NetworkIcon, Wifi, WifiOff, AlertTriangle, Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Network image component with fallback
interface NetworkImageProps {
  network: Network
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

function NetworkImage({ network, size = 'md', className = '' }: NetworkImageProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  const fallbackSizes = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const handleImageLoad = () => {
    setImageLoading(false)
    setImageError(false)
  }

  const handleImageError = () => {
    setImageLoading(false)
    setImageError(true)
  }

  if (imageError || !network?.logoUrl) {
    return (
      <div 
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white ${className}`}
        style={{ backgroundColor: network?.color || '#6B7280' }}
      >
        <span className={fallbackSizes[size]}>
          {network?.symbol?.slice(0, 2) || 'N/A'}
        </span>
      </div>
    )
  }

  return (
    <div className={`${sizeClasses[size]} ${className} relative`}>
      {imageLoading && (
        <div 
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white absolute inset-0 animate-pulse`}
          style={{ backgroundColor: network?.color || '#6B7280' }}
        >
          <span className={fallbackSizes[size]}>
            {network?.symbol?.slice(0, 2) || 'N/A'}
          </span>
        </div>
      )}
      <img
        src={network.logoUrl}
        alt={`${network.name} logo`}
        className={`${sizeClasses[size]} rounded-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </div>
  )
}

interface NetworkSelectorProps {
  showName?: boolean
  displayMode?: 'name' | 'logo' | 'both'
  compact?: boolean
  showStatus?: boolean
  showLogos?: boolean
  className?: string
}

export function NetworkSelector({ 
  showName = true, 
  displayMode = 'both',
  compact = false,
  showStatus = true,
  showLogos = true,
  className = ""
}: NetworkSelectorProps) {
  const { networks, isConnecting } = useNetwork() 
  const { chainId, isConnected, address } = useWallet() 
  const { authenticated } = usePrivy()
  
  const isWalletAvailable = typeof window !== "undefined" && window.ethereum
  const hasWalletConnected = authenticated && isConnected && !!address
  
  const currentNetwork = networks.find((net) => net.chainId === chainId)

  const getConnectionStatus = () => {
    if (isConnecting) return 'connecting' 
    if (!isWalletAvailable) return 'no-wallet'
    if (!hasWalletConnected) return 'disconnected'
    if (!chainId) return 'disconnected'
    if (currentNetwork && currentNetwork.chainId === chainId) return 'connected'
    if (chainId !== currentNetwork?.chainId) return 'wrong-network'
    return 'unknown-network'
  }

  const connectionStatus = getConnectionStatus()

  const displayText = () => {
    switch (connectionStatus) {
      case 'connecting': 
        return "Connecting..."
      case 'no-wallet':
        return "No Wallet Detected"
      case 'disconnected':
        return "Not Connected"
      case 'connected':
        return currentNetwork?.name || "Celo"
      case 'wrong-network':
        return `Wrong Network`
      case 'unknown-network':
        return `Unknown Chain`
      default:
        return "Celo Network"
    }
  }

  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case 'connecting': 
        return { icon: Loader2, color: 'text-blue-500 animate-spin' }
      case 'connected':
        return { icon: Wifi, color: 'text-green-500' }
      case 'wrong-network':
        return { icon: AlertTriangle, color: 'text-orange-500' }
      case 'no-wallet':
      case 'disconnected':
        return { icon: WifiOff, color: 'text-red-500' }
      case 'unknown-network':
        return { icon: AlertTriangle, color: 'text-yellow-500' }
      default:
        return { icon: NetworkIcon, color: 'text-gray-500' }
    }
  }

  const { icon: StatusIcon, color: statusColor } = getStatusIndicator()

  return (
    <Button 
      variant="outline" 
      className={`flex items-center gap-2 cursor-default hover:bg-background ${className}`}
      type="button"
      tabIndex={-1}
    >
      {showLogos && currentNetwork && connectionStatus === 'connected' ? (
        <NetworkImage network={currentNetwork} size={compact ? "xs" : "sm"} />
      ) : showStatus ? (
        <StatusIcon className={`h-4 w-4 ${statusColor}`} />
      ) : (
        <NetworkIcon className="h-4 w-4" />
      )}
      
      {displayMode !== 'logo' && showName && (
        <span className={compact ? "text-sm" : ""}>{displayText()}</span>
      )}
    </Button>
  )
}

export function CompactNetworkSelector({ className }: { className?: string }) {
  return (
    <NetworkSelector 
      displayMode="logo" 
      compact={true} 
      showName={false}
      showStatus={true}
      showLogos={true}
      className={className}
    />
  )
}

export function LogoOnlyNetworkSelector({ className }: { className?: string }) {
  return (
    <NetworkSelector 
      displayMode="logo" 
      showName={false}
      showStatus={true}
      showLogos={true}
      className={className}
    />
  )
}

export function NetworkStatusSelector({ className }: { className?: string }) {
  return (
    <NetworkSelector 
      displayMode="both" 
      showName={true}
      showStatus={true}
      showLogos={true}
      compact={false}
      className={className}
    />
  )
}

export function MobileNetworkSelector({ className }: { className?: string }) {
  const { networks, network } = useNetwork()
  const { isConnected, address } = useWallet() 
  const { authenticated } = usePrivy()

  const hasWalletConnected = authenticated && isConnected && !!address
  
  // Filter to only show the currently active network (or the first configured network if disconnected)
  const displayNetworks = hasWalletConnected && network ? [network] : networks.slice(0, 1)
  
  return (
    <div className={`grid grid-cols-1 gap-3 p-4 ${className}`}>
      {displayNetworks.map((net) => (
        <div
          key={net.chainId}
          className={`p-3 rounded-lg border-2 transition-all ${
            network?.chainId === net.chainId
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700'
          } ${!hasWalletConnected ? 'opacity-50' : ''}`}
        >
          <div className="flex items-center space-x-3">
            <NetworkImage network={net} size="sm" />
            <div className="text-left min-w-0">
              <div className="font-medium text-sm truncate">{net.name}</div>
              <div className="text-xs text-gray-500 truncate">Chain {net.chainId}</div>
              {net.isTestnet && (
                <div className="text-xs bg-orange-100 text-orange-600 px-1 rounded mt-1 inline-block">
                  Testnet
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function NetworkBreadcrumb({ className }: { className?: string }) {
  const { network } = useNetwork()
  
  if (!network) return null
  
  return (
    <div className={`flex items-center space-x-2 text-sm text-gray-500 ${className}`}>
      <NetworkImage network={network} size="xs" />
      <span className="font-medium">{network.name}</span>
      {network.isTestnet && (
        <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">
          Testnet
        </span>
      )}
    </div>
  )
}

export function NetworkStatusIndicator({ className }: { className?: string }) {
  const { network } = useNetwork()
  const { chainId, isConnected } = useWallet() 

  if (!isConnected || !network || !chainId) {
    return (
      <div className={`flex items-center space-x-2 text-red-600 ${className}`}>
        <div className="w-4 h-4 bg-red-400 rounded-full" />
        <span className="text-sm">No network connected</span>
      </div>
    )
  }
  
  const isCorrectNetwork = network.chainId === chainId
  
  return (
    <div className={`flex items-center space-x-2 ${isCorrectNetwork ? 'text-green-600' : 'text-amber-600'} ${className}`}>
      <NetworkImage network={network} size="xs" />
      <span className="text-sm">
        {isCorrectNetwork 
          ? `Connected to ${network.name}` 
          : `Wrong network (expected ${network.name})`
        }
      </span>
    </div>
  )
}

export function NetworkCard({ network: net, isActive }: { 
  network: Network; 
  isActive?: boolean 
}) {
  return (
    <div 
      className={`p-4 border-2 rounded-lg transition-all ${
        isActive 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-center space-x-4">
        <NetworkImage network={net} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold">{net.name}</h3>
            {net.isTestnet && (
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded">
                Testnet
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">Chain ID: {net.chainId}</p>
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-xs text-gray-500">
              {Object.keys(net.factories || {}).length} factory types
            </span>
            {isActive && (
              <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                Active
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function NetworkGrid() {
  const { networks, network } = useNetwork()
  
  // Only render the active/configured network to avoid confusion
  const displayNetworks = network ? [network] : networks.slice(0, 1)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {displayNetworks.map((net) => (
        <NetworkCard
          key={net.chainId}
          network={net}
          isActive={network?.chainId === net.chainId}
        />
      ))}
    </div>
  )
}

export function HorizontalNetworkSelector({ className }: { className?: string }) {
  const { networks, network } = useNetwork()
  const { isConnected, address } = useWallet() 
  const { authenticated } = usePrivy()

  const hasWalletConnected = authenticated && isConnected && !!address
  const displayNetworks = network ? [network] : networks.slice(0, 1)
  
  return (
    <div className={`flex items-center space-x-2 overflow-x-auto ${className}`}>
      {displayNetworks.map((net) => (
        <div
          key={net.chainId}
          className={`flex-shrink-0 p-2 rounded-lg border-2 transition-all ${
            network?.chainId === net.chainId
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700'
          } ${!hasWalletConnected ? 'opacity-50' : ''}`}
          title={net.name}
        >
          <NetworkImage network={net} size="sm" />
        </div>
      ))}
    </div>
  )
}

export function MiniNetworkIndicator({ className = "" }: { className?: string }) {
  const { networks } = useNetwork()
  const { chainId, isConnected } = useWallet()
  
  const currentNetwork = networks.find((net) => net.chainId === chainId)

  if (!isConnected) return null

  return (
    <div 
      className={cn(
        "flex items-center justify-center border border-border rounded-full bg-background h-9 w-9 shrink-0",
        className
      )}
      title={currentNetwork?.name || "Connected"}
    >
      {currentNetwork ? (
        <NetworkImage network={currentNetwork} size="sm" />
      ) : (
        <div className="w-5 h-5 rounded-full bg-muted animate-pulse flex items-center justify-center">
           <NetworkIcon size={12} className="text-muted-foreground" />
        </div>
      )}
    </div>
  )
}