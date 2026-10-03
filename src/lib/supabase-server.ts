import { createClient } from "@supabase/supabase-js"

/**
 * Server-side Supabase client. Uses the service-role key so API routes can
 * read/write Storage blobs and broadcast Realtime events without RLS.
 *
 * IMPORTANT: this key bypasses Row-Level Security. It must NEVER be imported
 * by client code (it would let anyone write/delete anything). It is only used
 * inside `app/api/**` route handlers, which run on the server.
 */

const url = process.env.SUPABASE_URL || ""
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!url || !serviceKey) {
  // Don't throw during build (prisma generate etc.) — only at request time.
  console.warn(
    "[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Set these in your environment for the app to work.",
  )
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const MEDIA_BUCKET = "media"
