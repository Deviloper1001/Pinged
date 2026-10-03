"use client"

import { useEffect, useRef, useState } from "react"
import { useChat } from "@/lib/chat-store"
import { MediaItem } from "./MediaItem"
import { cn } from "@/lib/utils"
import { useLongPress } from "@/hooks/use-long-press"
import { ShieldCheck, Trash2, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import type { DecryptedMessage } from "@/lib/types"

// Stable empty array so the selector never returns a fresh reference (which
// would trigger the Zustand "getSnapshot should be cached" infinite loop).
const EMPTY_MESSAGES: DecryptedMessage[] = []

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function MessageBubble({
  msg,
  mine,
  showSender,
}: {
  msg: DecryptedMessage
  mine: boolean
  showSender: boolean
}) {
  const deleteMessage = useChat((s) => s.deleteMessage)
  const [deleting, setDeleting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function doDelete() {
    setDeleting(true)
    const res = await deleteMessage(msg.id)
    setDeleting(false)
    setDialogOpen(false)
    if (res.error) toast.error(res.error)
    else toast.success("Message deleted")
  }

  // Press-and-hold (touch) opens the delete confirmation on phones.
  const longPress = useLongPress(() => {
    if (mine && !deleting) setDialogOpen(true)
  })

  return (
    <div className={cn("group flex flex-col", mine ? "items-end" : "items-start")}>
      {showSender && !mine && (
        <span className="text-xs font-semibold text-muted-foreground mb-1 ml-2">
          {msg.senderName || msg.senderUsername}
        </span>
      )}
      <div className={cn("relative flex items-end gap-1.5 min-w-0", mine ? "flex-row-reverse" : "flex-row")}>
        <div
          className={cn(
            "min-w-0 max-w-[62.5vw] sm:max-w-[62.5%] px-4 py-2.5 rounded-3xl text-[15px] leading-snug break-words shadow-sm",
            mine && "touch-callout-none",
            msg.pending && "opacity-60",
            mine
              ? "bg-primary text-primary-foreground rounded-br-lg"
              : "bg-card border border-border/60 rounded-bl-lg",
          )}
          {...(mine ? longPress : {})}
        >
          {msg.messageType === "text" ? (
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.text ?? "🔒"}</p>
          ) : (
            <MediaItem msg={msg} mine={mine} />
          )}
        </div>
        {mine && (
          <button
            type="button"
            // hidden on pure-touch devices (long-press is used there);
            // hover/focus reveals it on desktop.
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:hidden transition-opacity h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDialogOpen(true)}
            aria-label="Delete message"
            title="Delete message"
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      <span className={cn("text-[11px] text-muted-foreground mt-1", mine ? "mr-1 sm:mr-9" : "ml-2")}>
        {fmtTime(msg.createdAt)}
      </span>

      {mine && (
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this message?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove it from your view and everyone else&apos;s.
                {msg.messageType !== "text" && " The attached media will also be erased."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={doDelete}
                disabled={deleting}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

export function MessageList() {
  const conv = useChat((s) => s.selectedConv)
  const messages = useChat((s) => s.messagesByConv[conv] ?? EMPTY_MESSAGES)
  const myId = useChat((s) => s.user?.id)
  const loading = useChat((s) => s.loadingMessages)
  const typing = useChat((s) => s.typing)
  const users = useChat((s) => s.users)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, conv])

  const typingUsers = Object.entries(typing)
    .filter(([, v]) => v)
    .map(([uid]) => users.find((u) => u.id === uid)?.username)
    .filter(Boolean)

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Loading messages…
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2 text-muted-foreground">
        <ShieldCheck className="h-8 w-8 text-primary/60" />
        <p className="text-sm font-medium">No messages yet</p>
        <p className="text-xs max-w-xs">
          Say hello — your messages are encrypted end-to-end before they ever
          reach the server.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scroll-thin px-3 sm:px-5 py-4 space-y-3.5">
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          msg={m}
          mine={m.senderId === myId}
          showSender={conv === "everyone"}
        />
      ))}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
          <span className="flex items-end gap-0.5 h-3">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="eq-bar w-1 rounded-full bg-muted-foreground"
                style={{ height: "100%", animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
          {typingUsers.join(", ")} typing…
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
