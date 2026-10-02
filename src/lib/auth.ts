import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

const COOKIE_NAME = "pinged_session"
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me")

export type SessionUser = {
  id: string
  username: string
  displayName: string | null
  isAdmin: boolean
  mustChangePassword: boolean
  publicKey: string | null
}

export async function signToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload.sub ?? null
  } catch {
    return null
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  const userId = await verifyToken(token)
  if (!userId) return null
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return null
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    mustChangePassword: user.mustChangePassword,
    publicKey: user.publicKey,
  }
}

export async function setSessionCookie(userId: string) {
  const token = await signToken(userId)
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export const SESSION_COOKIE = COOKIE_NAME

// Used to authenticate to the socket.io mini-service.
export function socketTokenFor(userId: string) {
  // Reuse the same JWT mechanism so the socket service can verify with the same secret.
  return signToken(userId)
}
