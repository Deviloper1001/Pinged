import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"

// Returns the wrapped private key + salt + iv so the browser can unlock the
// private key locally. The plaintext private key never touches the server.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await db.user.findUnique({ where: { id: session.id } })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({
    publicKey: user.publicKey,
    encryptedPrivateKey: user.encryptedPrivateKey,
    keySalt: user.keySalt,
    keyIv: user.keyIv,
  })
}
