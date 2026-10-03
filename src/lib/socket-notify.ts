import { getSupabaseAdmin } from "@/lib/supabase-server"

/**
 * Broadcast an event to a Supabase Realtime channel. Browser clients subscribed
 * to the channel receive it instantly. Used for real-time message delivery,
 * presence, and typing indicators on Vercel (serverless — no long-lived socket
 * connection is possible, so we broadcast via Supabase after each write).
 *
 * The channel is subscribed and we wait for SUBSCRIBED status before sending,
 * so the message goes out over the WebSocket (not the REST fallback). Runs in
 * Next.js `after()` so the subscribe handshake doesn't block the HTTP response.
 */

export async function broadcast(
  channel: string,
  event: string,
  payload: unknown,
): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const ch = supabaseAdmin.channel(channel)

    // Subscribe and wait until the channel is joined before sending, so we
    // push the broadcast through the WebSocket instead of the deprecated REST
    // fallback. Give up after 5s to avoid hanging serverless functions.
    await new Promise<void>((resolve) => {
      let settled = false
      const t = setTimeout(() => {
        if (!settled) {
          settled = true
          resolve() // timeout — send anyway (will REST-fallback, which still works)
        }
      }, 5000)
      ch.subscribe((status) => {
        if (settled) return
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          settled = true
          clearTimeout(t)
          resolve()
        }
      })
    })

    await ch.send({ type: "broadcast", event, payload })
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
