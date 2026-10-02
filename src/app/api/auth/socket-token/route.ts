import { NextResponse } from "next/server"
import { getSession, signToken } from "@/lib/auth"
import { ensureChatServer } from "@/lib/chat-server"

// Returns a short-lived JWT the browser can hand to socket.io's `auth` option.
// The session cookie itself is httpOnly (unreadable by JS), so we mint a
// separate token here. Verified by the socket.io auth middleware using the
// same JWT_SECRET.
export async function GET() {
  ensureChatServer()
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const token = await signToken(session.id)
  return NextResponse.json({ token })
}
