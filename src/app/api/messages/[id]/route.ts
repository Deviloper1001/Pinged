import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { notifyUsers } from "@/lib/socket-notify"
import { UPLOAD_DIR } from "@/lib/uploads"
import { promises as fs } from "fs"
import path from "path"

// Only the sender may delete their own message. Deletion also removes the
// stored encrypted media blob (if any) and notifies everyone who could decrypt
// it so their clients remove it from view in real time.
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

  // remove encrypted media blob from disk (best-effort)
  if (msg.mediaFilename) {
    try {
      await fs.unlink(path.join(UPLOAD_DIR, msg.mediaFilename))
    } catch {
      /* already gone */
    }
  }

  await db.message.delete({ where: { id } })

  // tell every key-holder (sender + recipients) to drop it from their view
  let targetUserIds: string[] = []
  try {
    targetUserIds = Object.keys(JSON.parse(msg.encryptedKeys))
  } catch {
    targetUserIds = [session.id]
  }
  await notifyUsers(targetUserIds, "message-deleted", {
    id: msg.id,
    senderId: msg.senderId,
    isGroup: msg.isGroup,
    recipientId: msg.recipientId,
  })

  return NextResponse.json({ ok: true, id })
}
