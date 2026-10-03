"use client"

import { createClient } from "@supabase/supabase-js"

/**
 * Browser-side Supabase client. Uses the anon key (safe to expose) and is
 * only used for Realtime Broadcast subscriptions (message delivery, presence,
 * typing). All database + storage access goes through the API routes which use
 * the service-role client.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
// Accept both the new Supabase "publishable key" name and the legacy "anon key"
// name — they serve the same purpose (client-side key, safe to expose).
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""

export const supabaseBrowser = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ----- Realtime channel helpers -----------------------------------------------

/**
 * Deterministic channel name for a conversation.
 *  - group chat:  "everyone"
 *  - DM:          "dm:<smallerId>:<largerId>"  (sorted so both participants agree)
 */
export function channelForConversation(conv: string, myId: string): string {
  if (conv === "everyone") return "everyone"
  if (conv.startsWith("dm:")) {
    const otherId = conv.slice(3)
    return `dm:${[myId, otherId].sort().join(":")}`
  }
  return conv
}

/** Channel for broadcast-level events that every client should hear. */
export const GLOBAL_CHANNEL = "pinged-global"
