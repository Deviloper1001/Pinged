import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { downloadMediaBlob } from "@/lib/uploads"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { filename } = await params
  const bytes = await downloadMediaBlob(filename)
  if (!bytes) return NextResponse.json({ error: "File not found" }, { status: 404 })
  // Return the raw encrypted blob; the browser decrypts it with the message AES key.
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    },
  })
}
