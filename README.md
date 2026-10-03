# pinged

A lightweight, end-to-end encrypted messaging app for small friend groups. Admin-only sign-ups, image & voice support, zero-knowledge message storage — even the admin and developers cannot read your chats.

## ✨ Features

- **End-to-end encrypted** — messages are encrypted in the browser with RSA-OAEP + AES-GCM. The server only ever stores ciphertext.
- **Zero-knowledge keys** — each user's private key is generated in their browser, wrapped with their password, and never leaves it. Even full DB + server compromise yields no plaintext.
- **Admin-only accounts** — one admin creates every account with a temporary password, changed on first login (which also generates the user's keypair).
- **No email, no password restrictions** — just a username and a password you pick.
- **Direct messages + "Everyone" group chat**
- **Image & voice note support** — files are encrypted before upload.
- **Delete your own messages** (press-and-hold on mobile, hover on desktop).
- **Admin can delete member accounts.**
- **Display names** — set a friendly name shown in chats.
- **Real-time delivery** via Supabase Realtime Broadcast.
- **Dark/light theme**, responsive (mobile drawer sidebar), custom scrollbars.

## 🚀 Deploy on Vercel + Supabase

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and the **anon key** + **service_role key** (Project Settings → API).
3. Note the **database password** (set during project creation).
4. Create a **Storage bucket** named `media` (Storage → New bucket → Private).

### 2. Push the database schema

From your local machine (with the Supabase connection string):

```bash
# Set the env vars (or put them in a local .env)
export DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true"
export DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"

# Create all tables
bunx prisma db push

# Seed the admin account (username: admin, password: pass — forced change on first login)
bun run prisma/seed.ts
```

### 3. Deploy on Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → New Project → import the repo.
3. Add the environment variables (see `.env.example`):

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://...supabase.co:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | `postgresql://...supabase.co:5432/postgres` |
| `SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret (server-only) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `JWT_SECRET` | a long random string (`openssl rand -hex 32`) |

4. Deploy. Vercel runs `next build` automatically (the `postinstall` script runs `prisma generate`).

### 4. Log in

Open your Vercel URL, sign in with `admin` / `pass`, set a new password, and start creating accounts for your friends.

## 🔧 Local development

```bash
bun install
bun run db:push      # SQLite for local dev (default .env)
bun run prisma/seed.ts
bun run dev
```

Open http://localhost:3000, log in as `admin` / `pass`.

> **Note:** Local dev uses SQLite (a file in `db/`). Vercel uses Supabase Postgres. The Prisma schema supports both — just set `DATABASE_URL` appropriately.

## 🔒 Security model

- **Passwords:** bcrypt-hashed (one-way) — unrecoverable by anyone.
- **Private keys:** generated in the browser, wrapped with AES-GCM using a key derived from the user's password (PBKDF2, 150k iterations). Only the wrapped form is stored.
- **Messages:** each message gets a fresh AES-GCM key, RSA-encrypted once per recipient and stored as a JSON map. The server holds only ciphertext + wrapped keys.
- **Media:** encrypted in the browser before upload to Supabase Storage; useless without the per-message AES key.
- **Realtime:** Supabase Broadcast channels deliver message ciphertext to participants. Channel names are deterministic (`everyone` for group, `dm:<sortedIds>` for DMs). A determined attacker with the anon key could subscribe to channels and learn *that* a message was sent (metadata), but cannot decrypt the content. For a small friend group this is an acceptable tradeoff. (For stronger guarantees, switch to Supabase Realtime with RLS policies — requires Supabase Auth, which this app doesn't use.)

## 📁 Project structure

```
prisma/
  schema.prisma          # Postgres models (User, Message)
  seed.ts                # seeds the admin account
src/
  lib/
    auth.ts             # JWT session + bcrypt hashing
    client-crypto.ts    # browser E2E crypto (RSA-OAEP, AES-GCM, PBKDF2)
    crypto-session.ts   # in-memory private key singletons
    supabase-server.ts  # service-role client (Storage + Broadcast)
    supabase-browser.ts # anon-key client (Realtime subscriptions)
    uploads.ts          # Supabase Storage upload/download/delete
    socket-notify.ts    # Broadcast helpers (replaces socket.io)
  hooks/
    use-realtime.ts     # Supabase Realtime subscription hook
    use-presence.ts     # heartbeat-based presence polling
    use-long-press.ts   # press-and-hold for mobile delete
  app/api/              # API routes (auth, users, messages, media, presence)
  components/            # React UI (chat, auth screens, sidebar, etc.)
```

## 🛠 Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Prisma** (Postgres)
- **Supabase** (Postgres + Storage + Realtime)
- **Tailwind CSS 4** + **shadcn/ui**
- **Zustand** (state)
- **bcryptjs** (password hashing) + **jose** (JWT) + **Web Crypto API** (E2E)
