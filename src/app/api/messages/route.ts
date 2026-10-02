import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { ensureUploadDir, UPLOAD_DIR } from "@/lib/uploads"
import { notifyUsers } from "@/lib/socket-notify"
import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"

const PAGE_SIZE = 50

function serialize(msg: Awaited<ReturnType<typeof db.message.findFirst>>) {
  if (!msg) return null
  return {
    id: msg.id,
    senderId: msg.senderId,
    // sender may be null if the sender's account was later deleted
    senderUsername: msg.sender?.username ?? "deleted user",
    recipientId: msg.recipientId,
    isGroup: msg.isGroup,
    encryptedContent: msg.encryptedContent,
    encryptedKeys: msg.encryptedKeys,
    iv: msg.iv,
    messageType: msg.messageType,
    mediaFilename: msg.mediaFilename,
    createdAt: msg.createdAt,
  }
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const conversation = url.searchParams.get("conversation") || "everyone"
  const beforeParam = url.searchParams.get("before")
  const before = beforeParam ? new Date(beforeParam) : new Date()
  if (Number.isNaN(before.getTime())) {
    return NextResponse.json({ error: "Invalid before date" }, { status: 400 })
  }

  let messages: any[] = []

  if (conversation === "everyone") {
    // Group: a new member cannot decrypt messages sent before they joined (their public key
    // was not used to wrap the AES key), so we simply don't surface older messages.
    messages = await db.message.findMany({
      where: {
        isGroup: true,
        createdAt: { lt: before, gte: session.createdAt },
      },
      include: { sender: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    })
  } else if (conversation.startsWith("dm:")) {
    const otherId = conversation.slice(3)
    // We don't 404 if the other user was deleted — the requester may still want
    // to read their own side of the (encrypted) history. The sender username on
    // the deleted user's messages resolves to null, which the client handles.
    messages = await db.message.findMany({
      where: {
        OR: [
          { senderId: session.id, recipientId: otherId },
          { senderId: otherId, recipientId: session.id },
        ],
        isGroup: false,
        createdAt: { lt: before },
      },
      include: { sender: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    })
  } else {
    return NextResponse.json({ error: "Invalid conversation" }, { status: 400 })
  }

  return NextResponse.json({
    messages: messages.map(serialize).filter(Boolean),
  })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.mustChangePassword || !session.publicKey) {
    return NextResponse.json(
      { error: "You must complete first-time setup before messaging" },
      { status: 403 },
    )
  }

  const form = await req.formData()
  const messageType = (form.get("messageType") as string) || "text"
  const encryptedContent = (form.get("encryptedContent") as string) || ""
  const encryptedKeys = form.get("encryptedKeys") as string
  const iv = form.get("iv") as string
  const recipientId = (form.get("recipientId") as string) || null
  const isGroup = form.get("isGroup") === "true"
  const media = form.get("media") as File | null

  if (!encryptedKeys || !iv) {
    return NextResponse.json({ error: "Missing encryption data" }, { status: 400 })
  }
  if (!isGroup && !recipientId) {
    return NextResponse.json({ error: "recipientId required for DM" }, { status: 400 })
  }
  if (isGroup && recipientId) {
    return NextResponse.json({ error: "Group messages cannot have a recipientId" }, { status: 400 })
  }

  // Validate that the sender included a key for themselves.
  let keyMap: Record<string, string>
  try {
    keyMap = JSON.parse(encryptedKeys)
    if (!keyMap[session.id]) {
      return NextResponse.json({ error: "You must include a key for yourself" }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: "Invalid encryptedKeys JSON" }, { status: 400 })
  }

  // For DMs, make sure the recipient exists and has a keypair.
  if (!isGroup && recipientId) {
    const recipient = await db.user.findUnique({ where: { id: recipientId } })
    if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 })
    if (!recipient.publicKey) {
      return NextResponse.json(
        { error: "Recipient has not completed first-time setup yet" },
        { status: 409 },
      )
    }
    if (!keyMap[recipientId]) {
      return NextResponse.json(
        { error: "Recipient key missing from encryptedKeys" },
        { status: 400 },
      )
    }
  }

  let mediaFilename: string | null = null
  if (media && media.size > 0) {
    await ensureUploadDir()
    mediaFilename = crypto.randomUUID()
    const buffer = Buffer.from(await media.arrayBuffer())
    await fs.writeFile(path.join(UPLOAD_DIR, mediaFilename), buffer)
  }

  const message = await db.message.create({
    data: {
      senderId: session.id,
      recipientId: isGroup ? null : recipientId,
      isGroup,
      encryptedContent,
      encryptedKeys,
      iv,
      messageType,
      mediaFilename,
    },
    include: { sender: { select: { username: true } } },
  })

  // Notify everyone who has a key for this message (sender + recipients).
  const targetUserIds = Object.keys(keyMap)
  const payload = serialize(message)
  await notifyUsers(targetUserIds, "message", payload)

  return NextResponse.json({ message: payload })
}
