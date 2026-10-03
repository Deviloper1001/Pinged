import { getSupabaseAdmin } from "@/lib/supabase-server"

/**
 * Server-side broadcast via the Supabase Realtime REST API.
 *
 * Instead of creating a WebSocket channel + waiting for the SUBSCRIBED
 * handshake (200-500ms per call), we POST directly to the Realtime REST
 * endpoint. This is a one-shot HTTP request — much faster on serverless where
 * we don't need a persistent WebSocket connection (the server only ever
 * pushes one broadcast per write, then exits).
 *
 * Browser clients still receive the broadcast over their WebSocket
 * subscription to the same channel — the transport is just different on the
 * sending side.
 */

function restBroadcast(channel: string, event: string, payload: unknown) {
  const url = process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY (a.k.a. SUPABASE_SERVICE_ROLE_KEY)",
    )
  }
  return fetch(`${url}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: channel,
          event,
          payload,
          private: false,
        },
      ],
    }),
  })
}

export async function broadcast(
  channel: string,
  event: string,
  payload: unknown,
): Promise<void> {
  try {
    await restBroadcast(channel, event, payload)
  } catch (e) {
    console.error("[broadcast] REST failed, falling back to SDK:", e)
    // Fallback to the SDK (WebSocket) if the REST endpoint isn't available
    try {
      const supabaseAdmin = getSupabaseAdmin()
      const ch = supabaseAdmin.channel(channel)
      await ch.send({ type: "broadcast", event, payload })
      supabaseAdmin.removeChannel(ch)
    } catch (e2) {
      console.error("[broadcast] SDK fallback also failed:", e2)
    }
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
