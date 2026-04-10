import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, ShieldCheck, ExternalLink } from "lucide-react"
import { toast } from "sonner"

// Replace with your actual bot username (without the @)
const BOT_USERNAME = "FaucetDropsAuth_bot" 
const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app"

export function TelegramTaskSetup() {
  const [chatId, setChatId] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isBotAdmin, setIsBotAdmin] = useState(false)

  // The magic 1-click links
  const addToGroupLink = `https://t.me/${BOT_USERNAME}?startgroup=true&admin=invite_users,restrict_members`
  const addToChannelLink = `https://t.me/${BOT_USERNAME}?startchannel=true&admin=invite_users,post_messages`

  const verifyBotAccess = async () => {
    if (!chatId) return toast.error("Please enter your Group/Channel username (e.g., @MyGroup)")
    
    setIsVerifying(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/quests/verify-bot-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId })
      })
      
      const data = await res.json()
      
      if (data.is_admin) {
        setIsBotAdmin(true)
        toast.success("Success! Bot is connected and has admin rights.")
      } else {
        setIsBotAdmin(false)
        toast.error(data.message || "Bot is not an admin in this chat yet.")
      }
    } catch (error) {
      toast.error("Failed to verify bot status.")
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-muted/20 space-y-4">
      <h4 className="font-semibold text-sm">Setup Telegram Task</h4>
      
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">1. Add our Bot to your chat as an Admin</label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => window.open(addToGroupLink, '_blank')}>
            Add to Group <ExternalLink className="ml-2 h-3 w-3"/>
          </Button>
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => window.open(addToChannelLink, '_blank')}>
            Add to Channel <ExternalLink className="ml-2 h-3 w-3"/>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">2. Enter your Chat ID / Username</label>
        <div className="flex gap-2">
          <Input 
            placeholder="@YourAwesomeCommunity" 
            value={chatId} 
            onChange={(e) => {
              setChatId(e.target.value)
              setIsBotAdmin(false) // Reset status if they change the ID
            }}
          />
          <Button onClick={verifyBotAccess} disabled={isVerifying || isBotAdmin} variant={isBotAdmin ? "default" : "secondary"}>
            {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : (isBotAdmin ? <ShieldCheck className="h-4 w-4 text-green-400" /> : "Verify")}
          </Button>
        </div>
      </div>
      
      {isBotAdmin && (
        <p className="text-xs text-green-600 font-medium">✅ Ready! You can now save this task.</p>
      )}
    </div>
  )
}