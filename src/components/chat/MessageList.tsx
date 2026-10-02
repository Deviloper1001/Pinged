"use client"

import { useEffect, useRef, useState } from "react"
import { useChat } from "@/lib/chat-store"
import { MediaItem } from "./MediaItem"
import { cn } from "@/lib/utils"
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
  AlertDialogTrigger,
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

  async function doDelete() {
    setDeleting(true)
    const res = await deleteMessage(msg.id)
    setDeleting(false)
    if (res.error) toast.error(res.error)
    else toast.success("Message deleted")
  }

  return (
    <div className={cn("group flex flex-col", mine ? "items-end" : "items-start")}>
      {showSender && !mine && (
        <span className="text-xs font-medium text-muted-foreground mb-0.5 ml-1">
          {msg.senderUsername}
        </span>
      )}
      <div className={cn("relative flex items-end gap-1", mine ? "flex-row-reverse" : "flex-row")}>
        <div
          className={cn(
            "max-w-[78%] sm:max-w-[68%] px-3.5 py-2 rounded-2xl text-sm break-words shadow-sm",
            mine
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-card border border-border/60 rounded-bl-md",
          )}
        >
          {msg.messageType === "text" ? (
            <p className="whitespace-pre-wrap leading-relaxed">{msg.text ?? "🔒"}</p>
          ) : (
            <MediaItem msg={msg} mine={mine} />
          )}
        </div>
        {mine && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label="Delete message"
                title="Delete message"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </AlertDialogTrigger>
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
      <span className={cn("text-[10px] text-muted-foreground mt-0.5", mine ? "mr-8" : "ml-1")}>
        {fmtTime(msg.createdAt)}
      </span>
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
    <div className="flex-1 overflow-y-auto scroll-thin px-3 sm:px-5 py-4 space-y-2.5">
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
