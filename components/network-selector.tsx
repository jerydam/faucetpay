"use client"

import { useNetwork, type Network } from "@/hooks/use-network"
import { useWallet } from "@/components/wallet-provider"
import { Network as NetworkIcon } from "lucide-react"
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
  showLogos?: boolean
  className?: string
}

export function NetworkSelector({
  showName = true,
  displayMode = 'both',
  compact = false,
  showLogos = true,
  className = ""
}: NetworkSelectorProps) {
  const { networks } = useNetwork()

  // Always show Celo — find by chainId (Celo mainnet = 42220), fallback to first network
  const celoNetwork = networks.find((net) => net.chainId === 42220) ?? networks[0]

  return (
    <Button
      variant="outline"
      className={`flex items-center gap-2 cursor-default hover:bg-background ${className}`}
      type="button"
      tabIndex={-1}
    >
      {showLogos && celoNetwork ? (
        <NetworkImage network={celoNetwork} size={compact ? "xs" : "sm"} />
      ) : (
        <NetworkIcon className="h-4 w-4" />
      )}

      {displayMode !== 'logo' && showName && (
        <span className={compact ? "text-sm" : ""}>{celoNetwork?.name ?? "Celo"}</span>
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
      showLogos={true}
      compact={false}
      className={className}
    />
  )
}

export function MobileNetworkSelector({ className }: { className?: string }) {
  const { networks } = useNetwork()

  // Always show Celo
  const celoNetwork = networks.find((net) => net.chainId === 42220) ?? networks[0]
  const displayNetworks = celoNetwork ? [celoNetwork] : networks.slice(0, 1)

  return (
    <div className={`grid grid-cols-1 gap-3 p-4 ${className}`}>
      {displayNetworks.map((net) => (
        <div
          key={net.chainId}
          className="p-3 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 transition-all"
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
  const { networks } = useNetwork()
  const celoNetwork = networks.find((net) => net.chainId === 42220) ?? networks[0]

  if (!celoNetwork) return null

  return (
    <div className={`flex items-center space-x-2 text-sm text-gray-500 ${className}`}>
      <NetworkImage network={celoNetwork} size="xs" />
      <span className="font-medium">{celoNetwork.name}</span>
      {celoNetwork.isTestnet && (
        <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">
          Testnet
        </span>
      )}
    </div>
  )
}

export function NetworkStatusIndicator({ className }: { className?: string }) {
  const { networks } = useNetwork()
  const { isConnected } = useWallet()

  const celoNetwork = networks.find((net) => net.chainId === 42220) ?? networks[0]

  if (!celoNetwork) return null

  return (
    <div className={`flex items-center space-x-2 ${isConnected ? 'text-green-600' : 'text-red-600'} ${className}`}>
      <NetworkImage network={celoNetwork} size="xs" />
      <span className="text-sm">
        {isConnected
          ? `Connected to ${celoNetwork.name}`
          : `Not connected`
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
  const { networks } = useNetwork()

  // Only render Celo
  const celoNetwork = networks.find((net) => net.chainId === 42220) ?? networks[0]
  const displayNetworks = celoNetwork ? [celoNetwork] : networks.slice(0, 1)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {displayNetworks.map((net) => (
        <NetworkCard
          key={net.chainId}
          network={net}
          isActive={true}
        />
      ))}
    </div>
  )
}

export function HorizontalNetworkSelector({ className }: { className?: string }) {
  const { networks } = useNetwork()

  // Always show Celo
  const celoNetwork = networks.find((net) => net.chainId === 42220) ?? networks[0]
  const displayNetworks = celoNetwork ? [celoNetwork] : networks.slice(0, 1)

  return (
    <div className={`flex items-center space-x-2 overflow-x-auto ${className}`}>
      {displayNetworks.map((net) => (
        <div
          key={net.chainId}
          className="flex-shrink-0 p-2 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 transition-all"
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

  // Always show Celo
  const celoNetwork = networks.find((net) => net.chainId === 42220) ?? networks[0]

  return (
    <div
      className={cn(
        "flex items-center justify-center border border-border rounded-full bg-background h-9 w-9 shrink-0",
        className
      )}
      title={celoNetwork?.name ?? "Celo"}
    >
      {celoNetwork ? (
        <NetworkImage network={celoNetwork} size="sm" />
      ) : (
        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
          <NetworkIcon size={12} className="text-muted-foreground" />
        </div>
      )}
    </div>
  )
}