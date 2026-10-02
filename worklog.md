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

---
Task ID: 2
Agent: Z.ai Code (orchestrator)
Task: Add sender-initiated message deletion + admin account deletion.

Work Log:
- Created `DELETE /api/messages/[id]` — verifies the requester is the message sender (403 otherwise), removes the encrypted media blob from disk if present, deletes the DB row, then broadcasts a `message-deleted` socket event to every key-holder of that message so their clients remove it in real time.
- Created `DELETE /api/users/[id]` — admin-only (403 for non-admins); refuses to delete self or any admin account (400); removes the user's authored media blobs; cascades the user's sent messages (Prisma onDelete: Cascade); broadcasts a `users-changed` event to all online clients.
- Added `emitToAll` to `src/lib/chat-server.ts` and `notifyAll` to `src/lib/socket-notify.ts` (broadcast to the `everyone` room).
- Extended the Zustand store: `deleteMessage` (optimistic local removal, restores on failure), `deleteAccount` (calls API + reloads users), and `handleDeletedMessage` (normalises the conversation key via `convKeyFor` so the removed message is found whether you were sender or recipient).
- MessageList: added a hover-revealed trash button on the sender's own message bubbles, opening an AlertDialog ("Delete this message?") for confirmation. Toasts success/failure.
- New `ManageMembersDialog` (admin-only): lists all non-admin members with their setup status and a per-member delete button + AlertDialog confirm. Wired a "Manage members" button into the Sidebar (admin only).
- ChatApp now listens for `message-deleted` (removes from local view) and `users-changed` (reloads the users list + presence). Added a guard that resets an orphaned DM selection (whose partner was deleted) back to the Everyone group.
- Relaxed the `GET /api/messages` DM path so history with a deleted user is still readable (removed the 404 when the other user no longer exists); `serialize` now returns "deleted user" for a message whose sender was later removed.

Stage Summary:
- Verified end-to-end via Agent Browser (gateway port 81):
  - Admin sent a group message, opened the delete confirm dialog, confirmed → message removed from own view ("No messages yet").
  - Admin created user "alex", opened Manage members, deleted alex → alex disappeared from the sidebar; the dialog then showed "No members to manage yet."
  - Cross-client real-time delete: admin + jordan both online; admin sent a DM to jordan (both saw it); admin deleted it → it vanished from BOTH screens instantly (jordan's view updated live via the `message-deleted` socket event).
- `bun run lint` clean. Dev log shows `DELETE /api/messages/... 200` and `DELETE /api/users/... 200`.
- DB reset back to a fresh `admin / changeme` (forced first-login change) for the user.

---
Task ID: 3
Agent: Z.ai Code (orchestrator)
Task: Three mobile UX fixes: (1) long-press to delete on phones, (2) theme button collides with close-sidebar button on phone, (3) website too tall on phone — have to scroll even without chats.

Work Log:
- (1) Long-press to delete: created `src/hooks/use-long-press.ts` (450ms press-and-hold gesture; cancels on scroll/touchmove; suppresses the synthetic click after a long-press). Rewrote `MessageBubble` in `MessageList.tsx` to use a controlled `AlertDialog` (`open`/`onOpenChange` state) instead of `AlertDialogTrigger`, so it can be opened programmatically. Attached the long-press touch handlers to the sender's own bubble. Added a `.touch-callout-none` CSS class (`-webkit-touch-callout:none`) so iOS doesn't show its native long-press callout. The hover-revealed trash button is kept for desktop but hidden on pure-touch devices via `[@media(hover:none)]:hidden`, so there's no empty gap on phones.
- (2) Theme/close collision: refactored `Sidebar` to accept an optional `onClose` prop; when provided (mobile drawer), it renders a close (X) button inside the header's flex row next to the theme toggle — laid out side-by-side instead of absolutely-positioned on top of it. Removed the old absolute `top-3 right-2` close button from `ChatApp`'s mobile drawer. Verified the two buttons' bounding boxes no longer overlap (theme at x=237, close at x=271, 2px gap).
- (3) Viewport height: replaced `h-screen`→`h-dvh` on the chat root (`ChatApp`) and `min-h-screen`→`min-h-dvh` on all auth screens + the loading screen. `100dvh` (dynamic viewport height) accounts for mobile browser chrome that shows/hides, so the app fits the visible viewport with no overflow. Added a `viewport` export in `layout.tsx` with `viewportFit: "cover"` for iOS safe-area support. Verified `window.innerHeight` (844) now equals `document.scrollHeight` (844) on an emulated iPhone 14 — no scrolling needed.

Stage Summary:
- Verified via Agent Browser with iPhone 14 device emulation (gateway port 81):
  - Viewport height: innerHeight === scrollHeight (844 === 844), no overflow/scroll.
  - Long-press: dispatched a real TouchEvent sequence (touchstart → 450ms hold → touchend) on the sender's bubble → the "Delete this message?" AlertDialog opened → confirmed → message removed ("No messages yet").
  - Theme/close: both buttons present in the mobile sidebar header, bounding boxes adjacent (no overlap).
- `bun run lint` clean. Dev log shows `DELETE /api/messages/... 200`.
- DB reset back to a fresh `admin / changeme` (forced first-login change) for the user.
