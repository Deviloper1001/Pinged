"use client"

import { useEffect, useState } from "react"
import { useChat } from "@/lib/chat-store"
import { useRealtime } from "@/hooks/use-realtime"
import { usePresence } from "@/hooks/use-presence"
import { Sidebar } from "./Sidebar"
import { MessageList } from "./MessageList"
import { MessageComposer } from "./MessageComposer"
import type { EncryptedMessage } from "@/lib/types"
import { Menu, ShieldCheck, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ChatApp() {
  const user = useChat((s) => s.user)
  const users = useChat((s) => s.users)
  const selected = useChat((s) => s.selectedConv)
  const handleIncoming = useChat((s) => s.handleIncoming)
  const handleDeletedMessage = useChat((s) => s.handleDeletedMessage)
  const setOnline = useChat((s) => s.setOnline)
  const setTyping = useChat((s) => s.setTyping)
  const loadUsers = useChat((s) => s.loadUsers)
  const loadMessages = useChat((s) => s.loadMessages)
  const [mobileSidebar, setMobileSidebar] = useState(false)

  // Realtime subscriptions: new messages, deletions, typing, user-list changes
  useRealtime({
    onMessage: (msg) => void handleIncoming(msg),
    onDeleted: (data) => handleDeletedMessage(data),
    onTyping: (data) => setTyping(data.userId, data.isTyping),
    onUsersChanged: () => void loadUsers(),
    myId: user?.id ?? "",
    activeConv: selected,
  })

  // Presence (heartbeat polling — works on serverless)
  usePresence(user?.id, setOnline)

  // load messages when conversation changes (and none loaded yet)
  useEffect(() => {
    const convs = useChat.getState().messagesByConv
    if (!convs[selected]) void loadMessages(selected)
  }, [selected, loadMessages])

  // if the selected DM partner no longer exists (e.g. their account was
  // deleted), fall back to the Everyone group so the panel isn't orphaned.
  useEffect(() => {
    if (selected.startsWith("dm:")) {
      const partnerId = selected.slice(3)
      if (users.length > 0 && !users.some((u) => u.id === partnerId)) {
        useChat.getState().selectConv("everyone")
      }
    }
  }, [selected, users])

  const other = selected.startsWith("dm:")
    ? users.find((u) => u.id === selected.slice(3))
    : null

  const headerTitle =
    selected === "everyone"
      ? "Everyone"
      : other?.displayName || other?.username || "Direct message"
  const headerSub =
    selected === "everyone"
      ? "End-to-end encrypted group"
      : other?.publicKey
        ? "End-to-end encrypted"
        : "Waiting for member to set up their key"

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-72 lg:w-80 shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      {mobileSidebar && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileSidebar(false)}
          />
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85%] shadow-xl">
            <Sidebar onClose={() => setMobileSidebar(false)} />
          </div>
        </div>
      )}

      {/* Chat panel */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="flex items-center gap-2 h-16 px-3 sm:px-5 border-b bg-card/70 backdrop-blur shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={() => setMobileSidebar(true)}
            aria-label="Open conversations"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold truncate leading-tight">{headerTitle}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> {headerSub}
            </p>
          </div>
          <ShieldCheck className="h-5 w-5 text-primary/60 shrink-0" />
        </header>

        <MessageList />

        <MessageComposer />
      </main>

      {/* subtle gradient backdrop */}
      <div
        className={cn(
          "pointer-events-none fixed inset-0 -z-10",
          "bg-[radial-gradient(60rem_60rem_at_120%_-10%,oklch(0.92_0.06_165/0.5),transparent),radial-gradient(50rem_50rem_at_-10%_110%,oklch(0.92_0.05_180/0.4),transparent)]",
        )}
      />
    </div>
  )
}
