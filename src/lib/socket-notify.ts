// In-process socket notification helpers. The socket.io server lives in the same
// Next.js process (started via instrumentation.ts), so API routes can emit to
// connected clients directly with no HTTP hop and no shared secret.
import { emitToUsers, emitToAll } from "@/lib/chat-server"

export async function notifyUsers(
  targetUserIds: string[],
  event: string,
  data: unknown,
) {
  try {
    emitToUsers(targetUserIds, event, data)
  } catch (e) {
    console.error("socket notify failed", e)
  }
}

/** Notify every connected user (e.g. when a member is deleted). */
export async function notifyAll(event: string, data: unknown) {
  try {
    emitToAll(event, data)
  } catch (e) {
    console.error("socket notify-all failed", e)
  }
}
