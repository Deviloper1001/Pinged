export type MessageType = "text" | "image" | "voice"

export type SessionUser = {
  id: string
  username: string
  isAdmin: boolean
  mustChangePassword: boolean
  publicKey: string | null
  createdAt?: string
}

export type ConversationUser = {
  id: string
  username: string
  isAdmin: boolean
  publicKey: string | null
  mustChangePassword: boolean
  createdAt: string
}

export type EncryptedMessage = {
  id: string
  senderId: string
  senderUsername: string
  recipientId: string | null
  isGroup: boolean
  encryptedContent: string
  encryptedKeys: string // JSON map userId -> base64(encrypted AES key)
  iv: string
  messageType: MessageType
  mediaFilename: string | null
  createdAt: string
}

export type DecryptedMessage = {
  id: string
  senderId: string
  senderUsername: string
  isGroup: boolean
  messageType: MessageType
  createdAt: string
  text?: string
  mediaUrl?: string // object URL for image/voice (decrypted blob)
  // for lazy media decryption on render:
  mediaFilename?: string | null
  encryptedKeys?: string
  iv?: string
  pending?: boolean
}
