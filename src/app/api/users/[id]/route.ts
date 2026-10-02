import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { UPLOAD_DIR } from "@/lib/uploads"
import { notifyAll } from "@/lib/socket-notify"
import { promises as fs } from "fs"
import path from "path"

// Admin-only: delete a member account. The account's sent messages cascade
// (per the Prisma onDelete: Cascade relation). Media blobs authored by the
// deleted user are also removed from disk. The admin account cannot delete
// itself or any other admin account.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.isAdmin) {
    return NextResponse.json(
      { error: "Only the admin can delete accounts" },
      { status: 403 },
    )
  }
  const { id } = await params
  if (id === session.id) {
    return NextResponse.json(
      { error: "You cannot delete your own admin account" },
      { status: 400 },
    )
  }
  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (target.isAdmin) {
    return NextResponse.json(
      { error: "Admin accounts cannot be deleted" },
      { status: 400 },
    )
  }

  // remove this user's authored media blobs before the rows cascade-delete
  const ownMedia = await db.message.findMany({
    where: { senderId: id, NOT: { mediaFilename: null } },
    select: { mediaFilename: true },
  })
  for (const m of ownMedia) {
    if (m.mediaFilename) {
      try {
        await fs.unlink(path.join(UPLOAD_DIR, m.mediaFilename))
      } catch {
        /* ignore */
      }
    }
  }

  await db.user.delete({ where: { id } })

  // tell every online client to refresh their member list + presence
  await notifyAll("users-changed", { deletedId: id })

  return NextResponse.json({ ok: true, id })
}
