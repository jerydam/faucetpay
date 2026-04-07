// File: components/create-new-modal.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Droplets, ScrollText, BrainCircuit, ArrowRight, ArrowLeft } from "lucide-react"

// Import the new component
import CreateFaucetWizard from "@/components/CreateFaucetWizard"

interface CreateNewModalProps {
  onSuccess?: () => void;
}

export function CreateNewModal({ onSuccess }: CreateNewModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  
  // State to switch between the 'menu' selection and the 'faucet' wizard
  const [view, setView] = useState<'menu' | 'faucet'>('menu')

  const handleNavigate = (path: string) => {
    setIsOpen(false)
    router.push(path)
  }

  // Reset view to menu when closing
  const handleClose = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setTimeout(() => setView('menu'), 300) // Reset after animation
    }
  }

  const options = [
    {
      label: "Faucet",
      description: "Distribute tokens with custom rules.",
      icon: Droplets,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/20",
      // Instead of a path, we now use an action to switch views
      action: () => setView('faucet') 
    },
    {
      label: "Quest",
      description: "Engage users with on-chain tasks.",
      icon: ScrollText,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      path: "/quest/create-quest" 
    },
    {
      label: "Quiz",
      description: "Test knowledge and reward winners.",
      icon: BrainCircuit,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950/20",
      path: "/quiz/create-quiz" 
    }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button className="flex-1 md:flex-none bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
          <Plus className="h-4 w-4" /> 
          <span className="hidden sm:inline">Create New</span>
          <span className="sm:hidden">Create</span>
        </Button>
      </DialogTrigger>
      
      {/* Dynamic width: standard for menu, wider for the wizard */}
      <DialogContent className={`p-6 max-h-[90vh] overflow-y-auto transition-all duration-300 ${
        view === 'faucet' ? 'max-w-4xl' : 'sm:max-w-[600px]'
      }`}>
        
        {/* VIEW 1: SELECTION MENU */}
        {view === 'menu' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center sm:text-left">What would you like to create?</DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              {options.map((opt) => (
                <Card 
                  key={opt.label}
                  className="relative group cursor-pointer hover:border-primary/50 transition-all hover:shadow-md border-border"
                  onClick={() => {
                    if (opt.action) {
                      opt.action()
                    } else if (opt.path) {
                      handleNavigate(opt.path)
                    }
                  }}
                >
                  <div className="p-4 flex flex-col items-center sm:items-start text-center sm:text-left gap-3 h-full">
                    <div className={`p-3 rounded-full ${opt.bg} ${opt.color}`}>
                      <opt.icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold">{opt.label}</h3>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                    {/* Hover indicator */}
                    <div className="mt-auto pt-2 w-full flex justify-center sm:justify-start opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* VIEW 2: FAUCET WIZARD */}
        {view === 'faucet' && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="mb-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setView('menu')}
                className="gap-1 pl-0 hover:bg-transparent hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" /> Back to options
              </Button>
            </div>

            {/* Render the Wizard here and pass the props */}
            <CreateFaucetWizard 
              onSuccess={onSuccess} 
              closeModal={() => setIsOpen(false)} 
            />
          </div>
        )}

      </DialogContent>
    </Dialog>
  )
}