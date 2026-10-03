import { supabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-server"
import crypto from "crypto"

/**
 * Encrypted media blobs are stored in Supabase Storage (bucket: "media").
 * Filenames are random UUIDs; the blobs are ciphertext, so they are useless
 * without the per-message AES key (which is itself RSA-encrypted per recipient
 * and stored in Message.encryptedKeys).
 */

export async function uploadMediaBlob(
  bytes: Uint8Array | Buffer,
): Promise<string> {
  const filename = crypto.randomUUID()
  const { error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(filename, bytes, { contentType: "application/octet-stream" })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return filename
}

export async function downloadMediaBlob(
  filename: string,
): Promise<Uint8Array | null> {
  // Only allow our own UUID-style filenames — no path traversal.
  if (!/^[a-f0-9-]{36}$/i.test(filename)) return null
  const { data, error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .download(filename)
  if (error || !data) return null
  // data is a Blob; convert to Uint8Array
  const ab = await data.arrayBuffer()
  return new Uint8Array(ab)
}

export async function deleteMediaBlob(filename: string): Promise<void> {
  if (!/^[a-f0-9-]{36}$/i.test(filename)) return
  await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([filename])
}
