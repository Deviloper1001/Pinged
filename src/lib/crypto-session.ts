import {
  importPublicKey,
  unwrapPrivateKey,
  deriveWrappingKey,
  decryptForSelf,
  bytesToBase64,
  type EncryptedPayload,
} from "@/lib/client-crypto"
import type { ConversationUser } from "@/lib/types"

/**
 * Module-level singletons for crypto material. Kept out of the Zustand store
 * because CryptoKey objects are not serialisable and must not trigger re-renders.
 *
 * The private key lives only in memory for the duration of the browser session;
 * it is never persisted, so closing the tab clears it (re-login required).
 */
let privateKey: CryptoKey | null = null
let ownPublicKey: CryptoKey | null = null
const publicKeyCache = new Map<string, CryptoKey>()

export function getPrivateKey() {
  return privateKey
}

export function setPrivateKey(key: CryptoKey | null) {
  privateKey = key
}

export function getOwnPublicKey() {
  return ownPublicKey
}

export function setOwnPublicKey(key: CryptoKey | null) {
  ownPublicKey = key
}

export function clearCrypto() {
  privateKey = null
  ownPublicKey = null
  publicKeyCache.clear()
}

export async function getPublicKeyFor(user: ConversationUser): Promise<CryptoKey | null> {
  if (!user.publicKey) return null
  const cached = publicKeyCache.get(user.id)
  if (cached) return cached
  try {
    const key = await importPublicKey(user.publicKey)
    publicKeyCache.set(user.id, key)
    return key
  } catch {
    return null
  }
}

export async function unlockPrivateKey(
  password: string,
  material: {
    publicKey: string | null
    encryptedPrivateKey: string | null
    keySalt: string | null
    keyIv: string | null
  },
  myUserId: string,
): Promise<CryptoKey> {
  if (!material.encryptedPrivateKey || !material.keySalt || !material.keyIv || !material.publicKey) {
    throw new Error("Encryption keys are not set up yet")
  }
  const wrappingKey = await deriveWrappingKey(password, material.keySalt)
  const priv = await unwrapPrivateKey(
    material.encryptedPrivateKey,
    wrappingKey,
    material.keyIv,
  )
  privateKey = priv
  ownPublicKey = await importPublicKey(material.publicKey)
  return priv
}

export async function decryptMessage(
  msg: {
    messageType: "text" | "image" | "voice"
    encryptedContent: string
    encryptedKeys: string
    iv: string
    mediaBlob?: ArrayBuffer | null
  },
  myUserId: string,
): Promise<{ text?: string; mediaUrl?: string } | null> {
  const priv = getPrivateKey()
  if (!priv) return null
  const payload: EncryptedPayload = {
    encryptedContent: msg.encryptedContent,
    encryptedKeys: msg.encryptedKeys,
    iv: msg.iv,
  }
  try {
    if (msg.messageType === "text") {
      const buf = await decryptForSelf(payload, priv, myUserId)
      return { text: new TextDecoder().decode(buf) }
    }
    // media: decrypt the file blob (if provided) with the same key/iv
    if (!msg.mediaBlob) return { text: undefined }
    const raw = await decryptForSelf(
      {
        encryptedContent: bytesToBase64(new Uint8Array(msg.mediaBlob)),
        encryptedKeys: msg.encryptedKeys,
        iv: msg.iv,
      },
      priv,
      myUserId,
    )
    const mime =
      msg.messageType === "image" ? "image/png" : "audio/webm"
    const blob = new Blob([raw], { type: mime })
    return { mediaUrl: URL.createObjectURL(blob) }
  } catch {
    return null
  }
}
