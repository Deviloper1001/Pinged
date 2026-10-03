import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Server-side Supabase client. Uses the service-role key so API routes can
 * read/write Storage blobs and broadcast Realtime events without RLS.
 *
 * IMPORTANT: this key bypasses Row-Level Security. It must NEVER be imported
 * by client code (it would let anyone write/delete anything). It is only used
 * inside `app/api/**` route handlers, which run on the server.
 *
 * The client is created lazily on first use (NOT at module load) so the app
 * can build without env vars being present — Vercel's build phase doesn't
 * expose runtime env vars, and Next.js imports this module during "collecting
 * page data". At request time the env vars ARE available.
 */

export const MEDIA_BUCKET = "media"

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached
  const url = process.env.SUPABASE_URL || ""
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set these in your environment.",
    )
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
