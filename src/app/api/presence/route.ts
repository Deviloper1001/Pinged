import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"

// Presence on serverless (Vercel) is heartbeat-based. Each online client POSTs
// here every ~20s to refresh their `lastSeenAt`. The GET returns the list of
// users whose heartbeat is recent (within 60s). Not as tight as a socket
// connection but fine for a small friend group.

const PRESENCE_TTL_MS = 60_000 // consider online if seen in the last 60s

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS)
  const online = await db.user.findMany({
    where: { lastSeenAt: { gte: cutoff } },
    select: { id: true },
  })
  return NextResponse.json({ online: online.map((u) => u.id) })
}

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await db.user.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
