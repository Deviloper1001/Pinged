/**
 * Client-side end-to-end encryption for pinged.
 *
 * Threat model: the server (and therefore admin/dev with DB access) must NEVER be
 * able to read message contents or any user's private key.
 *
 * Design:
 *  - Each user owns an RSA-OAEP 2048-bit keypair generated in the browser.
 *  - The private key is wrapped with an AES-GCM key derived from the user's password
 *    (PBKDF2 / SHA-256 / 150k iterations). Only the wrapped form ever leaves the browser.
 *  - Each message gets a fresh random AES-GCM 256 key. That key is then RSA-OAEP
 *    encrypted once per recipient (including the sender) and stored as a JSON map.
 *  - The server only ever stores ciphertext + per-user wrapped keys.
 *
 * As a result, even full DB + server compromise yields only ciphertext.
 */

// ---------- base64 helpers ----------
export function bytesToBase64(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ""
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const enc = new TextEncoder()
const dec = new TextDecoder()

const PBKDF2_ITERATIONS = 150_000

// ---------- password -> wrapping key ----------
export async function deriveWrappingKey(
  password: string,
  saltB64: string,
): Promise<CryptoKey> {
  const salt = base64ToBytes(saltB64)
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

// ---------- RSA keypair ----------
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  )
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("spki", key)
  return bytesToBase64(raw)
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    base64ToBytes(b64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  )
}

export async function wrapPrivateKey(
  privateKey: CryptoKey,
  wrappingKey: CryptoKey,
  ivB64: string,
): Promise<string> {
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey)
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivB64) },
    wrappingKey,
    pkcs8,
  )
  return bytesToBase64(wrapped)
}

export async function unwrapPrivateKey(
  wrappedB64: string,
  wrappingKey: CryptoKey,
  ivB64: string,
): Promise<CryptoKey> {
  const pkcs8 = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivB64) },
    wrappingKey,
    base64ToBytes(wrappedB64),
  )
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"],
  )
}

export function randomSaltB64(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)))
}

export function randomIvB64(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(12)))
}

// ---------- hybrid message encryption ----------
export type Recipient = { id: string; publicKey: CryptoKey }

export type EncryptedPayload = {
  encryptedContent: string // base64
  encryptedKeys: string // JSON { userId: base64(encrypted AES key) }
  iv: string // base64
}

export async function encryptForRecipients(
  data: ArrayBuffer,
  recipients: Recipient[],
): Promise<EncryptedPayload> {
  // fresh symmetric key for this message
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encryptedContent = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    data,
  )
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey)

  const keyMap: Record<string, string> = {}
  for (const r of recipients) {
    const encKey = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      r.publicKey,
      rawAesKey,
    )
    keyMap[r.id] = bytesToBase64(encKey)
  }

  return {
    encryptedContent: bytesToBase64(encryptedContent),
    encryptedKeys: JSON.stringify(keyMap),
    iv: bytesToBase64(iv),
  }
}

export async function decryptForSelf(
  payload: EncryptedPayload,
  privateKey: CryptoKey,
  myUserId: string,
): Promise<ArrayBuffer> {
  const keyMap = JSON.parse(payload.encryptedKeys) as Record<string, string>
  const myEncKey = keyMap[myUserId]
  if (!myEncKey) throw new Error("You do not have a key for this message")

  const rawAesKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToBytes(myEncKey),
  )
  const aesKey = await crypto.subtle.importKey(
    "raw",
    rawAesKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  )
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
    aesKey,
    base64ToBytes(payload.encryptedContent),
  )
}

// ---------- text convenience ----------
export async function encryptText(
  text: string,
  recipients: Recipient[],
): Promise<EncryptedPayload> {
  return encryptForRecipients(enc.encode(text).buffer, recipients)
}

export async function decryptText(
  payload: EncryptedPayload,
  privateKey: CryptoKey,
  myUserId: string,
): Promise<string> {
  const buf = await decryptForSelf(payload, privateKey, myUserId)
  return dec.decode(buf)
}
