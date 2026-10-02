import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession, verifyPassword, hashPassword } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const { currentPassword, newPassword, publicKey, encryptedPrivateKey, keySalt, keyIv } = body
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 })
  }
  // No password restrictions by design - the user (small friend group) decides.
  const user = await db.user.findUnique({ where: { id: session.id } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const ok = await verifyPassword(String(currentPassword), user.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
  }

  // When setting a keypair for the first time we require the crypto material.
  // If the user already has a keypair and is just rotating their password, the client
  // must re-wrap the existing private key under the new password and send it again.
  if (!user.publicKey) {
    if (!publicKey || !encryptedPrivateKey || !keySalt || !keyIv) {
      return NextResponse.json(
        { error: "Encryption keys are required on first login" },
        { status: 400 },
      )
    }
  }

  const passwordHash = await hashPassword(String(newPassword))
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      ...(publicKey ? { publicKey: String(publicKey) } : {}),
      ...(encryptedPrivateKey ? { encryptedPrivateKey: String(encryptedPrivateKey) } : {}),
      ...(keySalt ? { keySalt: String(keySalt) } : {}),
      ...(keyIv ? { keyIv: String(keyIv) } : {}),
    },
  })

  return NextResponse.json({
    user: {
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      isAdmin: updated.isAdmin,
      mustChangePassword: updated.mustChangePassword,
      publicKey: updated.publicKey,
    },
  })
}
