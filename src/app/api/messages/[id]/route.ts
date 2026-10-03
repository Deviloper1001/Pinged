import { NextResponse, after } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { broadcastMessageDeleted } from "@/lib/socket-notify"
import { deleteMediaBlob } from "@/lib/uploads"

// Only the sender may delete their own message. Deletion also removes the
// stored encrypted media blob (if any) and broadcasts a delete event to the
// conversation's Realtime channel so all clients remove it from view.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const msg = await db.message.findUnique({ where: { id } })
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (msg.senderId !== session.id) {
    return NextResponse.json(
      { error: "You can only delete your own messages" },
      { status: 403 },
    )
  }

  // remove encrypted media blob from Supabase Storage (best-effort)
  if (msg.mediaFilename) {
    try {
      await deleteMediaBlob(msg.mediaFilename)
    } catch {
      /* already gone */
    }
  }

  await db.message.delete({ where: { id } })

  // broadcast to the conversation channel so every participant removes it
  // (in the background — don't block the response)
  const channel = msg.isGroup
    ? "everyone"
    : `dm:${[msg.senderId, msg.recipientId!].sort().join(":")}`
  after(() => broadcastMessageDeleted(channel, {
    id: msg.id,
    senderId: msg.senderId,
    isGroup: msg.isGroup,
    recipientId: msg.recipientId,
  }))

  return NextResponse.json({ ok: true, id })
}
