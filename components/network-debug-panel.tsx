"use client"

import { useNetwork } from "@/hooks/use-network"
import { useWallet } from "@/hooks/use-wallet"
import { useEffect, useState } from "react"

export function NetworkDebugPanel() {
  const network = useNetwork()
  const wallet = useWallet()
  const [updateCount, setUpdateCount] = useState(0)

  // Track updates
  useEffect(() => {
    setUpdateCount(prev => prev + 1)
    console.log(`[NetworkDebugPanel] Re-render #${updateCount + 1}`)
  }, [network.network, network.currentChainId])

  return (
    <div className="fixed top-4 right-4 bg-black/90 text-white p-4 rounded-lg shadow-lg max-w-sm text-xs font-mono z-50 space-y-2">
      <div className="font-bold text-sm border-b border-white/20 pb-2 mb-2">
        🔍 Network State Debug (Updates: {updateCount})
      </div>
      
      <div className="space-y-1">
        <div className="text-yellow-400">useNetwork():</div>
        <div className="pl-2 space-y-0.5">
          <div>network.name: <span className="text-green-400">{network.network?.name || 'null'}</span></div>
          <div>network.chainId: <span className="text-green-400">{network.network?.chainId || 'null'}</span></div>
          <div>currentChainId: <span className="text-green-400">{network.currentChainId || 'null'}</span></div>
          <div>isSwitching: <span className="text-green-400">{network.isSwitchingNetwork ? 'true' : 'false'}</span></div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-yellow-400">useWallet():</div>
        <div className="pl-2 space-y-0.5">
          <div>isConnected: <span className="text-green-400">{wallet.isConnected ? 'true' : 'false'}</span></div>
          <div>chainId: <span className="text-green-400">{wallet.chainId || 'null'}</span></div>
          <div>address: <span className="text-green-400">{wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'null'}</span></div>
        </div>
      </div>

      <div className="pt-2 border-t border-white/20 text-xs text-gray-400">
        Click console (F12) for detailed logs
      </div>
    </div>
  )
}