import { supabaseAdmin } from "@/lib/supabase-server"

/**
 * Broadcast an event to a Supabase Realtime channel. Browser clients subscribed
 * to the channel receive it instantly. Used for real-time message delivery,
 * presence, and typing indicators on Vercel (serverless — no long-lived socket
 * connection is possible, so we broadcast via Supabase after each write).
 */

export async function broadcast(
  channel: string,
  event: string,
  payload: unknown,
): Promise<void> {
  try {
    const ch = supabaseAdmin.channel(channel)
    await ch.send({ type: "broadcast", event, payload })
    // Supabase channels are cheap to create but should be removed after send
    // on the server to avoid leaking. The broadcast itself is fire-and-forget.
    supabaseAdmin.removeChannel(ch)
  } catch (e) {
    console.error("[broadcast] failed", e)
  }
}

/**
 * Broadcast a new/deleted message to the conversation channel so all
 * participants receive it in real time. The payload is the serialized message
 * (ciphertext only — clients decrypt with their own private key).
 */
export async function broadcastMessage(
  channel: string,
  message: unknown,
): Promise<void> {
  await broadcast(channel, "message", message)
}

export async function broadcastMessageDeleted(
  channel: string,
  data: { id: string; senderId: string },
): Promise<void> {
  await broadcast(channel, "message-deleted", data)
}

/** Notify every client that the user list changed (account created/deleted,
 * display name changed) so they reload it. */
export async function broadcastUsersChanged(): Promise<void> {
  await broadcast("pinged-global", "users-changed", {})
}
