/**
 * Runs once when the Next.js server boots. We use it to start the in-process
 * socket.io chat server on port 3003 so it lives as long as the app does.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startChatServer } = await import("@/lib/chat-server")
    startChatServer()
  }
}
