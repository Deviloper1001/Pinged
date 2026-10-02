import { promises as fs } from "fs"
import path from "path"

export const UPLOAD_DIR = path.join(process.cwd(), "uploads")

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}
