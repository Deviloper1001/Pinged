"use client"

import { useState } from "react"
import { useChat } from "@/lib/chat-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { Wordmark } from "@/components/brand"
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react"

export function LoginScreen() {
  const login = useChat((s) => s.login)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await login(username.trim().toLowerCase(), password)
    setBusy(false)
    if (res.error) setError(res.error)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-accent/40">
      <Card className="w-full max-w-sm shadow-lg border-border/60">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <CardDescription className="text-sm">
            Sign in to your private group chat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your username"
                disabled={busy}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                disabled={busy}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy || !username || !password}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              Sign in
            </Button>
          </form>
          <div className="mt-5 flex items-start gap-2 rounded-lg bg-accent/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>
              Messages are end-to-end encrypted in your browser. Even the admin
              and developers cannot read your chats — only you and your friends
              hold the keys.
            </span>
          </div>
        </CardContent>
      </Card>
      <p className="mt-6 text-xs text-muted-foreground text-center max-w-sm">
        No email needed. Accounts are created by the group admin. First login
        requires setting a new password and encryption key.
      </p>
    </div>
  )
}
