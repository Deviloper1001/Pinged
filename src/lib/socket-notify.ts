// In-process socket notification helper. The socket.io server lives in the same
// Next.js process (started via instrumentation.ts), so API routes can emit to
// connected clients directly with no HTTP hop and no shared secret.
import { emitToUsers } from "@/lib/chat-server"

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
