import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { ensureChatServer } from "@/lib/chat-server"

export async function GET() {
  ensureChatServer()
  const session = await getSession()
  if (!session) return NextResponse.json({ user: null })
  return NextResponse.json({ user: session })
}
