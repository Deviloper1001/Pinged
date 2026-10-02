"use client"

import { useEffect } from "react"
import { useChat } from "@/lib/chat-store"
import { LoginScreen } from "@/components/auth/LoginScreen"
import { ChangePasswordScreen } from "@/components/auth/ChangePasswordScreen"
import { UnlockScreen } from "@/components/auth/UnlockScreen"
import { ChatApp } from "@/components/chat/ChatApp"
import { Logo } from "@/components/brand"
import { disconnectSocket } from "@/lib/socket-client"
import { clearCrypto } from "@/lib/crypto-session"

export default function Home() {
  const status = useChat((s) => s.status)
  const init = useChat((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  // clean up socket + crypto on full unmount
  useEffect(() => {
    return () => {
      disconnectSocket()
      clearCrypto()
    }
  }, [])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-12 w-12 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading pinged…</p>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return <LoginScreen />
  }

  if (status === "need-change-password") {
    return <ChangePasswordScreen />
  }

  if (status === "need-unlock") {
    return <UnlockScreen />
  }

  return <ChatApp />
}
