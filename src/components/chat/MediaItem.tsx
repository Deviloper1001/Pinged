"use client"

import { useEffect, useState } from "react"
import { useChat } from "@/lib/chat-store"
import { decryptMessage } from "@/lib/crypto-session"
import { Loader2, ImageIcon, Mic, Play, AlertCircle } from "lucide-react"
import type { DecryptedMessage } from "@/lib/types"

export function MediaItem({ msg, mine }: { msg: DecryptedMessage; mine: boolean }) {
  const setMediaUrl = useChat((s) => s.setMediaUrl)
  const myId = useChat((s) => s.user?.id)
  const [err, setErr] = useState(false)
  const [loading, setLoading] = useState(!msg.mediaUrl)

  useEffect(() => {
    if (msg.mediaUrl || !msg.mediaFilename || !myId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/media/${msg.mediaFilename}`, { credentials: "include" })
        if (!res.ok) throw new Error("fetch failed")
        const buf = await res.arrayBuffer()
        const out = await decryptMessage(
          {
            messageType: msg.messageType as "image" | "voice",
            encryptedContent: "",
            encryptedKeys: msg.encryptedKeys || "",
            iv: msg.iv || "",
            mediaBlob: buf,
          },
          myId,
        )
        if (cancelled) return
        if (out?.mediaUrl) setMediaUrl(msg.id, out.mediaUrl)
        else setErr(true)
      } catch {
        if (!cancelled) setErr(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [msg.id, msg.mediaUrl, msg.mediaFilename, msg.encryptedKeys, msg.iv, msg.messageType, myId, setMediaUrl])

  if (msg.mediaUrl) {
    if (msg.messageType === "image") {
      return (
        <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="block">
          <img
            src={msg.mediaUrl}
            alt="shared image"
            className="max-w-full max-h-96 rounded-xl border border-border/50"
          />
        </a>
      )
    }
    return (
      <div className={`flex items-center gap-3 rounded-xl ${mine ? "bg-primary-foreground/10" : "bg-background"} px-3 py-2 min-w-[220px]`}>
        <audio controls src={msg.mediaUrl} className="h-10 w-full" />
        <Mic className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    )
  }

  if (err) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
        <AlertCircle className="h-4 w-4" /> unable to decrypt media
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : msg.messageType === "image" ? (
        <ImageIcon className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      decrypting {msg.messageType}…
    </div>
  )
}
