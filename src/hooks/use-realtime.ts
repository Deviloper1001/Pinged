"use client"

import { useEffect, useRef } from "react"
import { supabaseBrowser } from "@/lib/supabase-browser"
import type { EncryptedMessage } from "@/lib/types"

type DeletedPayload = {
  id: string
  senderId: string
  isGroup: boolean
  recipientId: string | null
}

type Handlers = {
  onMessage: (msg: EncryptedMessage) => void
  onDeleted: (data: DeletedPayload) => void
  onUsersChanged: () => void
  onTyping: (data: { userId: string; conversation: string; isTyping: boolean }) => void
  myId: string
  /** the conversation currently being viewed ("everyone" or "dm:<otherId>") */
  activeConv: string
}

/**
 * Subscribes to Supabase Realtime Broadcast channels for live message
 * delivery, deletions, user-list changes, and typing indicators.
 *
 * On Vercel there's no long-lived socket connection, so after each API write
 * the server broadcasts to the relevant channel; this hook receives it.
 */

// Module-level cache of subscribed channels so broadcastTyping can reuse the
// already-joined channel instead of creating (and sending before join on) a
// new one each keystroke — which was causing the "Realtime send() is
// automatically falling back to REST API" deprecation warning.
const subscribedChannels = new Map<string, ReturnType<typeof supabaseBrowser.channel>>()

function channelNameFor(conv: string, myId: string): string | null {
  if (conv === "everyone") return "everyone"
  if (conv.startsWith("dm:")) {
    const otherId = conv.slice(3)
    return `dm:${[myId, otherId].sort().join(":")}`
  }
  return null
}

export function useRealtime(h: Handlers) {
  const hRef = useRef(h)
  // Update the ref inside an effect so it's never mutated during render.
  useEffect(() => {
    hRef.current = h
  })

  // --- Conversation channel (messages + deletions + typing) ---
  useEffect(() => {
    const conv = hRef.current.activeConv
    const myId = hRef.current.myId
    if (!myId) return

    const channelName = channelNameFor(conv, myId)
    if (!channelName) return

    const ch = supabaseBrowser.channel(channelName)
    ch.on("broadcast", { event: "message" }, (res) => {
      hRef.current.onMessage(res.payload as EncryptedMessage)
    })
    ch.on("broadcast", { event: "message-deleted" }, (res) => {
      hRef.current.onDeleted(res.payload as DeletedPayload)
    })
    ch.on("broadcast", { event: "typing" }, (res) => {
      hRef.current.onTyping(res.payload as { userId: string; conversation: string; isTyping: boolean })
    })
    ch.subscribe()
    // cache it so broadcastTyping reuses the joined channel
    subscribedChannels.set(channelName, ch)

    return () => {
      subscribedChannels.delete(channelName)
      supabaseBrowser.removeChannel(ch)
    }
  }, [h.activeConv, h.myId])

  // --- Global channel (user list changes) ---
  useEffect(() => {
    const ch = supabaseBrowser.channel("pinged-global")
    ch.on("broadcast", { event: "users-changed" }, () => {
      hRef.current.onUsersChanged()
    })
    ch.subscribe()
    return () => {
      supabaseBrowser.removeChannel(ch)
    }
  }, [])
}

/**
 * Broadcast a typing indicator to the active conversation channel.
 * Reuses the already-subscribed channel from useRealtime (so no REST fallback
 * warning + much lower latency since the WebSocket is already joined).
 */
export async function broadcastTyping(
  conversation: string,
  myId: string,
  isTyping: boolean,
) {
  const channelName = channelNameFor(conversation, myId)
  if (!channelName) return
  const ch = subscribedChannels.get(channelName)
  if (!ch) return // channel not subscribed (e.g. not viewing this conv) — skip
  await ch.send({
    type: "broadcast",
    event: "typing",
    payload: { userId: myId, conversation, isTyping },
  })
}
