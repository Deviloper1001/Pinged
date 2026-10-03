import { NextResponse, after } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { broadcastUsersChanged } from "@/lib/socket-notify"

// Update the signed-in user's own profile (currently: display name).
// The display name is shown in chats instead of the username handle; it's
// optional and falls back to the username when empty.
export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  let displayName = (body.displayName as unknown) ?? null
  if (typeof displayName === "string") {
    displayName = displayName.trim()
    if (displayName.length === 0) displayName = null
    if (displayName.length > 40) {
      return NextResponse.json({ error: "Display name is too long (max 40)" }, { status: 400 })
    }
  } else {
    displayName = null
  }

  const updated = await db.user.update({
    where: { id: session.id },
    data: { displayName },
    select: {
      id: true,
      username: true,
      displayName: true,
      isAdmin: true,
      mustChangePassword: true,
      publicKey: true,
    },
  })

  // tell everyone to refresh their member list (background — don't block)
  after(() => broadcastUsersChanged())

  return NextResponse.json({ user: updated })
}
