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

    let channelName: string
    if (conv === "everyone") {
      channelName = "everyone"
    } else if (conv.startsWith("dm:")) {
      const otherId = conv.slice(3)
      channelName = `dm:${[myId, otherId].sort().join(":")}`
    } else {
      return
    }

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

    return () => {
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

/** Broadcast a typing indicator to the active conversation channel. */
export async function broadcastTyping(
  conversation: string,
  myId: string,
  isTyping: boolean,
) {
  let channelName: string
  if (conversation === "everyone") {
    channelName = "everyone"
  } else if (conversation.startsWith("dm:")) {
    const otherId = conversation.slice(3)
    channelName = `dm:${[myId, otherId].sort().join(":")}`
  } else {
    return
  }
  const ch = supabaseBrowser.channel(channelName)
  await ch.send({
    type: "broadcast",
    event: "typing",
    payload: { userId: myId, conversation, isTyping },
  })
  supabaseBrowser.removeChannel(ch)
}
