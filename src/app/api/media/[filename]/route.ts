import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { UPLOAD_DIR } from "@/lib/uploads"
import { promises as fs } from "fs"
import path from "path"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { filename } = await params
  // Only allow our own UUID-style filenames - no path traversal.
  if (!/^[a-f0-9-]{36}$/i.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
  }
  const filePath = path.join(UPLOAD_DIR, filename)
  try {
    const data = await fs.readFile(filePath)
    // Return the raw encrypted blob; the browser decrypts it with the message AES key.
    return new Response(data, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
