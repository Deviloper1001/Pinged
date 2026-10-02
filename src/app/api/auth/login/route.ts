import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyPassword, setSessionCookie } from "@/lib/auth"

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}))
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
  }
  const user = await db.user.findUnique({ where: { username: String(username).toLowerCase() } })
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }
  const ok = await verifyPassword(String(password), user.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }
  await setSessionCookie(user.id)
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      mustChangePassword: user.mustChangePassword,
      publicKey: user.publicKey,
      createdAt: user.createdAt,
    },
  })
}
