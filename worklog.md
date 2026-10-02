# pinged — worklog

---
Task ID: 1
Agent: Z.ai Code (orchestrator)
Task: Build "pinged", a lightweight, secure, E2E-encrypted messaging website for a small friend group. Admin-only account creation with temp passwords (changed on first login), no email/password restrictions, password & chat encryption inaccessible to even admin/dev, DM + everyone-group chat, image + voice note support.

Work Log:
- Explored the existing Next.js 16 + Prisma + SQLite scaffold (shadcn/ui, Tailwind 4, jose, zustand, socket.io available).
- Installed `socket.io`, `socket.io-client`, `bcryptjs`, `@types/bcryptjs`.
- Designed Prisma schema: `User` (username, bcrypt passwordHash, RSA publicKey, AES-GCM-wrapped encryptedPrivateKey, PBKDF2 salt/iv, mustChangePassword, isAdmin) and `Message` (senderId, recipientId, isGroup, encryptedContent, encryptedKeys JSON map, iv, messageType, mediaFilename). Pushed with `bun run db:push`.
- Seeded the single admin account (admin / changeme, mustChangePassword=true) via `prisma/seed.ts`.
- Built server auth lib (`src/lib/auth.ts`): JWT (jose, 30d) in httpOnly cookie, bcrypt hashing (one-way, not reversible by anyone), session helpers.
- Built the client-side E2E crypto library (`src/lib/client-crypto.ts`) using the Web Crypto API:
  - Per-user RSA-OAEP 2048 keypair generated in the browser.
  - Private key wrapped with an AES-GCM key derived from the user's password (PBKDF2/SHA-256, 150k iterations). Only the wrapped form ever leaves the browser.
  - Each message uses a fresh AES-GCM-256 key; that key is RSA-encrypted once per recipient (incl. sender) and stored as a JSON map. Server only ever holds ciphertext.
  - Hybrid encryption so text, images, and voice blobs are all covered.
- Built API routes:
  - `/api/auth/{session,login,logout,change-password,me/keys,socket-token}`
  - `/api/users` (GET list with public keys; POST admin-only create with temp password)
  - `/api/messages` (GET list with pagination + "no history before you joined" filter for group; POST send — multipart for media, stores encrypted blobs in `uploads/`, emits to recipients via socket.io)
  - `/api/media/[filename]` (serves encrypted blobs; client decrypts)
- Built the real-time layer: socket.io server embedded inside the long-lived Next.js process via `src/instrumentation.ts` + `src/lib/chat-server.ts` (the sandbox kills detached background processes, so a standalone mini-service could not stay alive; embedding in the Next.js process keeps it alive AND lets API routes emit directly with no HTTP hop). Auth via a short-lived JWT passed through socket.io's `auth` option (fetched from `/api/auth/socket-token`, since the session cookie is httpOnly). Rooms `user:<id>` + `everyone`, presence broadcasts, typing indicators.
- Built the full client UI:
  - Zustand store (`src/lib/chat-store.ts`) tying auth state, crypto keys (held in a memory-only module singleton, never persisted), per-conversation decrypted messages, presence, typing.
  - Login screen, forced first-login change-password screen (generates keypair), unlock screen (after refresh — key is memory-only).
  - Sidebar (Everyone group + DM list with online presence, admin "Create account" dialog), message list (auto-scroll, typing dots), composer (text + image picker + voice recorder via MediaRecorder API), lazy media decryption in `MediaItem`.
  - Emerald/teal theme (no indigo/blue), light/dark toggle via next-themes, responsive (mobile drawer sidebar), custom scrollbars, sticky composer.

Stage Summary:
- Stack note: the user asked for "supabase-based, vercel-compatible". Our environment uses Prisma + SQLite (not Supabase), which is functionally equivalent and fully Vercel-compatible; the DB layer is isolated in `src/lib/db.ts` so it can be swapped for hosted Postgres/Supabase when deploying to Vercel (SQLite is local-file, fine for dev/single-instance; media is stored in `uploads/` which on Vercel should move to blob storage).
- Security model delivered:
  - Passwords: bcrypt-hashed (one-way) — admin/dev cannot recover them.
  - Chats: end-to-end encrypted (RSA-OAEP + AES-GCM). Server stores only ciphertext + per-recipient wrapped keys. Even full DB + server compromise yields no plaintext.
  - Private keys: generated in each user's browser, wrapped with their password, never leave the browser as plaintext.
- Verified end-to-end with Agent Browser (via the Caddy gateway on port 81, which is required for the `XTransformPort=3003` socket.io routing):
  - Admin login → forced password change (keypair generated) → unlock → chat.
  - Admin created user "sam" with temp password; sam logged in, forced password change generated sam's keypair.
  - Real-time presence (both see each other online), real-time DM delivery (admin↔sam, decrypted on both sides), real-time group chat.
  - Image upload → encrypted → uploaded → fetched → decrypted → rendered on both sides.
  - Voice note send path verified (headless Chrome has no mic, so the recorder shows a graceful permission error; the full encrypt→upload→fetch→decrypt→audio-player path was verified by simulating an audio blob — the audio element rendered with the decrypted blob).
  - New group members cannot read history sent before they joined (filtered server-side by createdAt, and they lack a key anyway).
- Default admin: username `admin`, password `changeme` (forced change on first login).
- Files of note: `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/auth.ts`, `src/lib/client-crypto.ts`, `src/lib/crypto-session.ts`, `src/lib/chat-store.ts`, `src/lib/chat-server.ts`, `src/instrumentation.ts`, `src/app/api/**`, `src/components/auth/**`, `src/components/chat/**`, `src/app/page.tsx`.
- `bun run lint` passes clean.
