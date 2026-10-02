"use client"

import { create } from "zustand"
import { apiGet, apiPost, apiForm } from "@/lib/api-client"
import {
  encryptText,
  encryptForRecipients,
  randomSaltB64,
  randomIvB64,
  generateKeyPair,
  exportPublicKey,
  wrapPrivateKey,
  deriveWrappingKey,
  base64ToBytes,
  type Recipient,
} from "@/lib/client-crypto"
import {
  setPrivateKey,
  getOwnPublicKey,
  setOwnPublicKey,
  getPublicKeyFor,
  unlockPrivateKey,
  clearCrypto,
  decryptMessage,
} from "@/lib/crypto-session"
import type {
  SessionUser,
  ConversationUser,
  EncryptedMessage,
  DecryptedMessage,
  MessageType,
} from "@/lib/types"

type Status =
  | "loading"
  | "unauthenticated"
  | "need-change-password"
  | "need-unlock"
  | "ready"

function convKeyFor(msg: EncryptedMessage, myId: string): string {
  if (msg.isGroup) return "everyone"
  return msg.senderId === myId ? `dm:${msg.recipientId}` : `dm:${msg.senderId}`
}

type ChatStore = {
  status: Status
  user: SessionUser | null
  pendingTempPassword: string | null
  users: ConversationUser[]
  messagesByConv: Record<string, DecryptedMessage[]>
  selectedConv: string
  onlineUserIds: string[]
  typing: Record<string, boolean>
  loadingMessages: boolean
  initError: string | null

  init: () => Promise<void>
  login: (username: string, password: string) => Promise<{ error?: string }>
  completeFirstLogin: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ error?: string }>
  unlock: (password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  selectConv: (conv: string) => void
  loadUsers: () => Promise<void>
  loadMessages: (conv: string) => Promise<void>
  handleIncoming: (msg: EncryptedMessage) => Promise<void>
  setMediaUrl: (msgId: string, url: string) => void
  sendText: (text: string) => Promise<{ error?: string }>
  sendMedia: (file: File | Blob, type: MessageType) => Promise<{ error?: string }>
  setOnline: (ids: string[]) => void
  setTyping: (userId: string, isTyping: boolean) => void
}

async function buildRecipients(
  conv: string,
  users: ConversationUser[],
  myId: string,
): Promise<Recipient[]> {
  const list: Recipient[] = []
  let ids: string[]
  if (conv === "everyone") {
    ids = users.filter((u) => u.publicKey).map((u) => u.id)
  } else {
    ids = [myId, conv.slice(3)]
  }
  for (const id of ids) {
    if (id === myId) {
      const pk = getOwnPublicKey()
      if (pk) list.push({ id: myId, publicKey: pk })
    } else {
      const u = users.find((x) => x.id === id)
      if (u && u.publicKey) {
        const pk = await getPublicKeyFor(u)
        if (pk) list.push({ id: u.id, publicKey: pk })
      }
    }
  }
  return list
}

async function tryDecrypt(
  msg: EncryptedMessage,
  myId: string,
): Promise<DecryptedMessage> {
  const base: DecryptedMessage = {
    id: msg.id,
    senderId: msg.senderId,
    senderUsername: msg.senderUsername,
    isGroup: msg.isGroup,
    messageType: msg.messageType,
    createdAt: msg.createdAt,
  }
  if (msg.messageType === "text") {
    const res = await decryptMessage(
      {
        messageType: "text",
        encryptedContent: msg.encryptedContent,
        encryptedKeys: msg.encryptedKeys,
        iv: msg.iv,
      },
      myId,
    )
    if (res) base.text = res.text
  } else {
    // media: decrypt lazily on render (component will fetch the blob)
    base.mediaFilename = msg.mediaFilename
    base.encryptedKeys = msg.encryptedKeys
    base.iv = msg.iv
  }
  return base
}

export const useChat = create<ChatStore>((set, get) => ({
  status: "loading",
  user: null,
  pendingTempPassword: null,
  users: [],
  messagesByConv: {},
  selectedConv: "everyone",
  onlineUserIds: [],
  typing: {},
  loadingMessages: false,
  initError: null,

  init: async () => {
    try {
      const { user } = await apiGet<{ user: SessionUser | null }>("/api/auth/session")
      if (!user) {
        set({ status: "unauthenticated", user: null })
        return
      }
      set({ user })
      if (user.mustChangePassword) {
        set({ status: "need-change-password" })
      } else {
        set({ status: "need-unlock" })
      }
    } catch (e) {
      set({ status: "unauthenticated", initError: (e as Error).message })
    }
  },

  login: async (username, password) => {
    try {
      const { user } = await apiPost<{ user: SessionUser }>("/api/auth/login", {
        username,
        password,
      })
      set({ user })
      if (user.mustChangePassword) {
        set({ status: "need-change-password", pendingTempPassword: password })
      } else {
        // unlock the private key with the password we just used
        const material = await apiGet<{
          publicKey: string | null
          encryptedPrivateKey: string | null
          keySalt: string | null
          keyIv: string | null
        }>("/api/auth/me/keys")
        await unlockPrivateKey(password, material, user.id)
        set({ status: "ready" })
        await get().loadUsers()
      }
      return {}
    } catch (e) {
      return { error: (e as Error).message }
    }
  },

  completeFirstLogin: async (currentPassword, newPassword) => {
    const user = get().user
    if (!user) return { error: "Not logged in" }
    try {
      // 1. generate a fresh keypair in the browser
      const pair = await generateKeyPair()
      const salt = randomSaltB64()
      const iv = randomIvB64()
      const wrappingKey = await deriveWrappingKey(newPassword, salt)
      const wrapped = await wrapPrivateKey(pair.privateKey, wrappingKey, iv)
      const pubB64 = await exportPublicKey(pair.publicKey)
      // 2. send to server (password hash + wrapped private key + public key)
      const { user: updated } = await apiPost<{ user: SessionUser }>(
        "/api/auth/change-password",
        {
          currentPassword,
          newPassword,
          publicKey: pubB64,
          encryptedPrivateKey: wrapped,
          keySalt: salt,
          keyIv: iv,
        },
      )
      // 3. keep the freshly generated private key in memory
      setPrivateKey(pair.privateKey)
      setOwnPublicKey(pair.publicKey)
      set({ user: updated, pendingTempPassword: null, status: "ready" })
      await get().loadUsers()
      return {}
    } catch (e) {
      return { error: (e as Error).message }
    }
  },

  unlock: async (password) => {
    const user = get().user
    if (!user) return { error: "Not logged in" }
    try {
      const material = await apiGet<{
        publicKey: string | null
        encryptedPrivateKey: string | null
        keySalt: string | null
        keyIv: string | null
      }>("/api/auth/me/keys")
      await unlockPrivateKey(password, material, user.id)
      set({ status: "ready" })
      await get().loadUsers()
      return {}
    } catch (e) {
      return { error: "Incorrect password" }
    }
  },

  logout: async () => {
    try {
      await apiPost("/api/auth/logout", {})
    } catch {}
    clearCrypto()
    set({
      status: "unauthenticated",
      user: null,
      users: [],
      messagesByConv: {},
      pendingTempPassword: null,
    })
  },

  selectConv: (conv) => {
    set({ selectedConv: conv, typing: {} })
    const existing = get().messagesByConv[conv]
    if (!existing) void get().loadMessages(conv)
  },

  loadUsers: async () => {
    try {
      const { users } = await apiGet<{ users: ConversationUser[] }>("/api/users")
      set({ users })
    } catch {}
  },

  loadMessages: async (conv) => {
    set({ loadingMessages: true })
    try {
      const { messages } = await apiGet<{ messages: EncryptedMessage[] }>(
        `/api/messages?conversation=${encodeURIComponent(conv)}`,
      )
      const myId = get().user!.id
      const decrypted: DecryptedMessage[] = []
      for (const m of messages) {
        decrypted.push(await tryDecrypt(m, myId))
      }
      // oldest first
      decrypted.reverse()
      set((s) => ({
        messagesByConv: { ...s.messagesByConv, [conv]: decrypted },
        loadingMessages: false,
      }))
    } catch {
      set({ loadingMessages: false })
    }
  },

  handleIncoming: async (msg) => {
    const myId = get().user?.id
    if (!myId) return
    const conv = convKeyFor(msg, myId) // normalize to the OTHER participant's id
    // only care about messages for the active context
    const current = get().messagesByConv[conv]
    if (current?.some((m) => m.id === msg.id)) return // dedupe
    const decrypted = await tryDecrypt(msg, myId)
    set((s) => {
      const list = s.messagesByConv[conv] || []
      return {
        messagesByConv: { ...s.messagesByConv, [conv]: [...list, decrypted] },
      }
    })
  },

  setMediaUrl: (msgId, url) => {
    set((s) => {
      const next = { ...s.messagesByConv }
      for (const conv of Object.keys(next)) {
        const idx = next[conv].findIndex((m) => m.id === msgId)
        if (idx >= 0) {
          const copy = [...next[conv]]
          copy[idx] = { ...copy[idx], mediaUrl: url }
          next[conv] = copy
        }
      }
      return { messagesByConv: next }
    })
  },

  sendText: async (text) => {
    const state = get()
    const conv = state.selectedConv
    const myId = state.user!.id
    try {
      const recipients = await buildRecipients(conv, state.users, myId)
      if (recipients.length === 0) return { error: "No recipients available" }
      const payload = await encryptText(text, recipients)
      const form = new FormData()
      form.append("messageType", "text")
      form.append("encryptedContent", payload.encryptedContent)
      form.append("encryptedKeys", payload.encryptedKeys)
      form.append("iv", payload.iv)
      if (conv === "everyone") form.append("isGroup", "true")
      else {
        form.append("recipientId", conv.slice(3))
        form.append("isGroup", "false")
      }
      const { message } = await apiForm<{ message: EncryptedMessage }>(
        "/api/messages",
        form,
      )
      // We already know the plaintext; add locally (dedupe vs socket).
      const existing = get().messagesByConv[conv]
      if (!existing?.some((m) => m.id === message.id)) {
        const dm: DecryptedMessage = {
          id: message.id,
          senderId: message.senderId,
          senderUsername: message.senderUsername,
          isGroup: message.isGroup,
          messageType: "text",
          createdAt: message.createdAt,
          text,
        }
        set((s) => {
          const list = s.messagesByConv[conv] || []
          return {
            messagesByConv: { ...s.messagesByConv, [conv]: [...list, dm] },
          }
        })
      }
      return {}
    } catch (e) {
      return { error: (e as Error).message }
    }
  },

  sendMedia: async (file, type) => {
    const state = get()
    const conv = state.selectedConv
    const myId = state.user!.id
    try {
      const recipients = await buildRecipients(conv, state.users, myId)
      if (recipients.length === 0) return { error: "No recipients available" }
      const buf = await file.arrayBuffer()
      const payload = await encryptForRecipients(buf, recipients)
      const form = new FormData()
      form.append("messageType", type)
      form.append("encryptedContent", "")
      form.append("encryptedKeys", payload.encryptedKeys)
      form.append("iv", payload.iv)
      // the encrypted file blob (decoded from the base64 payload)
      form.append("media", new Blob([base64ToBytes(payload.encryptedContent)]))
      if (conv === "everyone") form.append("isGroup", "true")
      else {
        form.append("recipientId", conv.slice(3))
        form.append("isGroup", "false")
      }
      const { message } = await apiForm<{ message: EncryptedMessage }>(
        "/api/messages",
        form,
      )
      // For the sender, decrypt our own media to display locally.
      const existing = get().messagesByConv[conv]
      if (!existing?.some((m) => m.id === message.id)) {
        const dm: DecryptedMessage = {
          id: message.id,
          senderId: message.senderId,
          senderUsername: message.senderUsername,
          isGroup: message.isGroup,
          messageType: type,
          createdAt: message.createdAt,
          mediaFilename: message.mediaFilename,
          encryptedKeys: message.encryptedKeys,
          iv: message.iv,
        }
        set((s) => {
          const list = s.messagesByConv[conv] || []
          return {
            messagesByConv: { ...s.messagesByConv, [conv]: [...list, dm] },
          }
        })
      }
      return {}
    } catch (e) {
      return { error: (e as Error).message }
    }
  },

  setOnline: (ids) => set({ onlineUserIds: ids }),
  setTyping: (userId, isTyping) => {
    set((s) => ({ typing: { ...s.typing, [userId]: isTyping } }))
  },
}))
