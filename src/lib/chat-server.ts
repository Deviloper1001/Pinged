/**
 * In-process socket.io server for real-time message delivery.
 *
 * Why embedded instead of a separate mini-service?
 * The sandbox terminates detached background processes when the spawning shell
 * exits, so a standalone socket.io process cannot stay alive here. By starting
 * the socket.io server inside the long-lived Next.js server process (via
 * instrumentation.ts) it persists for the lifetime of the app, and the API
 * routes can push events to connected clients directly (no HTTP hop, no shared
 * secret). Functionally identical to a separate service.
 */
import { Server, type Socket } from "socket.io"
import { jwtVerify } from "jose"

const PORT = 3003
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me")
const SESSION_COOKIE = "pinged_session"

function parseCookie(header: string, name: string): string | null {
  const parts = header.split(";")
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=")
    if (k === name) return decodeURIComponent(rest.join("="))
  }
  return null
}

type AuthPayload = { sub?: string }

type GlobalWithIo = typeof globalThis & {
  __pingedIo?: Server
  __pingedBooted?: boolean
}

const g = globalThis as GlobalWithIo

export function getIo(): Server | null {
  return g.__pingedIo ?? null
}

/** Idempotently boot the chat server if it isn't running yet. */
export function ensureChatServer() {
  if (!g.__pingedBooted) startChatServer()
}

async function verify(token: string): Promise<string | null> {
  try {
    const { payload } = (await jwtVerify(token, JWT_SECRET)) as { payload: AuthPayload }
    return payload.sub ?? null
  } catch {
    return null
  }
}

function broadcastPresence(io: Server, socketsByUser: Map<string, Set<string>>) {
  io.emit("presence", { online: Array.from(socketsByUser.keys()) })
}

export function startChatServer() {
  if (g.__pingedBooted) return
  g.__pingedBooted = true

  const io = new Server(PORT, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000,
  })
  g.__pingedIo = io

  const onlineBySocket = new Map<string, string>()
  const socketsByUser = new Map<string, Set<string>>()

  io.use(async (socket, next) => {
    try {
      // Prefer the explicit token the browser hands to socket.io's `auth`
      // option (the session cookie is httpOnly, so JS can't read it directly;
      // the client fetches a short-lived token from /api/auth/socket-token).
      // Fall back to the session cookie for same-origin polling.
      const token =
        (socket.handshake.auth?.token as string) ||
        parseCookie((socket.handshake.headers.cookie as string) || "", SESSION_COOKIE)
      if (!token) return next(new Error("no token"))
      const userId = await verify(token)
      if (!userId) return next(new Error("bad token"))
      ;(socket as Socket & { userId?: string }).userId = userId
      next()
    } catch (e) {
      next(e as Error)
    }
  })

  io.on("connection", (socket) => {
    const userId = (socket as Socket & { userId?: string }).userId
    if (!userId) {
      socket.disconnect(true)
      return
    }

    onlineBySocket.set(socket.id, userId)
    let set = socketsByUser.get(userId)
    if (!set) {
      set = new Set()
      socketsByUser.set(userId, set)
    }
    set.add(socket.id)
    void socket.join(`user:${userId}`)
    void socket.join("everyone")
    broadcastPresence(io, socketsByUser)

    socket.on("disconnect", () => {
      onlineBySocket.delete(socket.id)
      const s = socketsByUser.get(userId)
      if (s) {
        s.delete(socket.id)
        if (s.size === 0) socketsByUser.delete(userId)
      }
      broadcastPresence(io, socketsByUser)
    })

    socket.on("typing", (data: { conversation: string; isTyping: boolean }) => {
      if (data.conversation === "everyone") {
        socket.to("everyone").emit("typing", {
          userId,
          conversation: data.conversation,
          isTyping: data.isTyping,
        })
      } else if (data.conversation.startsWith("dm:")) {
        const otherId = data.conversation.slice(3)
        io.to(`user:${otherId}`).emit("typing", {
          userId,
          conversation: data.conversation,
          isTyping: data.isTyping,
        })
      }
    })
  })

  io.engine.on("connection_error", (err: unknown) => {
    console.error("[chat] connection error", err)
  })

  console.log(`[chat] socket.io server listening on port ${PORT}`)
}

/** Push an event to a set of users (in-process, no network hop). */
export function emitToUsers(userIds: string[], event: string, data: unknown) {
  ensureChatServer()
  const io = getIo()
  if (!io) return
  for (const uid of userIds) {
    io.to(`user:${uid}`).emit(event, data)
  }
}

/** Push an event to every connected user (the "everyone" room). */
export function emitToAll(event: string, data: unknown) {
  ensureChatServer()
  const io = getIo()
  if (!io) return
  io.to("everyone").emit(event, data)
}
