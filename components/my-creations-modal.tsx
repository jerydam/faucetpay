"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Library, Droplets, ScrollText, BrainCircuit, ExternalLink, Loader2 } from "lucide-react"

// Backend URL
const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app"

interface CreationItem {
  id: string
  name: string
  type: 'faucet' | 'quest' | 'quiz'
  chain: string
  createdAt: string
  status: 'active' | 'paused'
}

interface QuestOverview {
    faucetAddress: string;
    title: string;
    description: string;
    isActive: boolean;
    rewardPool: string;
    creatorAddress: string;
    startDate: string;
}

interface QuizOverview {
    code: string;           // Changed from id
    title: string;
    creatorAddress: string;
    status: string;         // Changed from isActive
    createdAt: string;      // Changed from created_at
}

export function MyCreationsModal({ faucets = [], address }: { faucets: any[], address?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  
  const [quests, setQuests] = useState<CreationItem[]>([])
  const [quizzes, setQuizzes] = useState<CreationItem[]>([])
  
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && address) {
      fetchLibrary()
    }
  }, [isOpen, address])

  const fetchLibrary = async () => {
    setLoading(true)
    try {
      // 1. Fetch Quests
      const questRes = await fetch(`${API_BASE_URL}/api/quests`)
      const questData = await questRes.json()

      if (questData.success && Array.isArray(questData.quests)) {
        const userQuests = questData.quests
          .filter((q: QuestOverview) => q.creatorAddress.toLowerCase() === address?.toLowerCase())
          .map((q: QuestOverview) => ({
            id: q.faucetAddress,
            name: q.title,
            type: 'quest' as const,
            chain: "N/A", 
            createdAt: q.startDate, 
            status: q.isActive ? 'active' as const : 'paused' as const
          }))
        setQuests(userQuests)
      }

     try {
        // FIXED: Using the correct endpoint that the Dashboard uses
        const quizRes = await fetch(`${API_BASE_URL}/api/quiz/list?t=${Date.now()}`)
        
        if (quizRes.ok) {
            const quizData = await quizRes.json()
            if (quizData.success && Array.isArray(quizData.quizzes)) {
                const userQuizzes = quizData.quizzes
                .filter((q: QuizOverview) => q.creatorAddress?.toLowerCase() === address?.toLowerCase())
                .map((q: QuizOverview) => ({
                    id: q.code, // FIXED: Backend uses 'code' as the unique identifier
                    name: q.title,
                    type: 'quiz' as const,
                    chain: "N/A",
                    createdAt: q.createdAt || new Date().toISOString(), // FIXED: Backend uses camelCase 'createdAt'
                    // Map the string status ('waiting', 'active', 'finished') to the allowed union type
                    status: q.status === 'active' ? 'active' as const : 'paused' as const 
                }))
                setQuizzes(userQuizzes)
            }
        }
      } catch (e) {
          console.warn("Failed to fetch quizzes:", e)
      }

    } catch (err) {
      console.error("Failed to fetch library", err)
    } finally {
      setLoading(false)
    }
  }

  // Combine Data
  const faucetItems: CreationItem[] = faucets.map((f: any) => ({
    id: f.faucetAddress,
    name: f.name,
    type: 'faucet' as const,
    chain: f.chainId.toString(),
    createdAt: f.createdAt || new Date().toISOString(),
    status: 'active' as const
  }))

  const allCreations = [...faucetItems, ...quests, ...quizzes].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const getIcon = (type: string) => {
    switch(type) {
      case 'faucet': return <Droplets className="h-4 w-4 text-blue-500" />
      case 'quest': return <ScrollText className="h-4 w-4 text-amber-500" />
      case 'quiz': return <BrainCircuit className="h-4 w-4 text-purple-500" />
      default: return <Library className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 w-full sm:w-auto">
          <Library className="h-4 w-4" />
          <span className="hidden sm:inline">My Library</span>
          <span className="sm:hidden">Library</span>
        </Button>
      </DialogTrigger>
      
      {/* Responsive Content Sizing */}
      <DialogContent className="w-[95%] sm:max-w-[600px] h-[85vh] sm:h-[80vh] flex flex-col p-4 sm:p-6 rounded-lg">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Library className="h-5 w-5" /> My Creations Library
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-1">
            {/* Grid layout for mobile tabs */}
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 h-auto">
              <TabsTrigger value="all" className="text-xs sm:text-sm px-1 py-1.5">All</TabsTrigger>
              <TabsTrigger value="faucet" className="text-xs sm:text-sm px-1 py-1.5">Faucets</TabsTrigger>
              <TabsTrigger value="quest" className="text-xs sm:text-sm px-1 py-1.5">Quests</TabsTrigger>
              <TabsTrigger value="quiz" className="text-xs sm:text-sm px-1 py-1.5">Quizzes</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 mt-4 pr-2 sm:pr-4">
            {loading ? (
               <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 <p className="text-xs">Syncing library...</p>
               </div>
            ) : (
                <div className="space-y-3 mt-1 pb-4">
                    {/* Render Content Based on Tab Selection */}
                    <TabsContent value="all" className="space-y-3 mt-0">
                        {allCreations.length === 0 ? <EmptyState /> : 
                            allCreations.map((item, idx) => <CreationCard key={idx} item={item} getIcon={getIcon} />)
                        }
                    </TabsContent>
                    
                    <TabsContent value="faucet" className="space-y-3 mt-0">
                        {faucetItems.length === 0 ? <EmptyState msg="No faucets found" /> :
                            faucetItems.map((item, idx) => <CreationCard key={idx} item={item} getIcon={getIcon} />)
                        }
                    </TabsContent>

                    <TabsContent value="quest" className="space-y-3 mt-0">
                        {quests.length === 0 ? <EmptyState msg="No quests found" /> :
                            quests.map((item, idx) => <CreationCard key={idx} item={item} getIcon={getIcon} />)
                        }
                    </TabsContent>

                    <TabsContent value="quiz" className="space-y-3 mt-0">
                        {quizzes.length === 0 ? <EmptyState msg="No quizzes found" /> :
                            quizzes.map((item, idx) => <CreationCard key={idx} item={item} getIcon={getIcon} />)
                        }
                    </TabsContent>
                </div>
            )}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function CreationCard({ item, getIcon }: { item: CreationItem, getIcon: any }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group">
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Responsive Icon Size */}
        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center shrink-0 border">
          {getIcon(item.type)}
        </div>
        
        <div className="min-w-0 flex-1">
          <h4 className="font-medium truncate text-sm sm:text-base">{item.name}</h4>
          
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-0.5">
            <Badge variant="secondary" className="text-[10px] h-4 sm:h-5 px-1 capitalize">
              {item.type}
            </Badge>
            {item.chain !== "N/A" && <span className="hidden xs:inline">• Chain: {item.chain}</span>}
            <span className="hidden sm:inline">• {new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-2">
        <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className="text-[10px] capitalize h-5">
            {item.status}
        </Badge>
        {/* Hide external link button on very small screens to save space, or make it always visible but smaller */}
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  )
}

function EmptyState({ msg = "No items found" }: { msg?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed rounded-lg bg-muted/10">
            <div className="bg-muted p-3 rounded-full mb-3">
                <Library className="h-6 w-6 text-muted-foreground opacity-50" />
            </div>
            <p className="text-muted-foreground text-sm">{msg}</p>
        </div>
    )
}