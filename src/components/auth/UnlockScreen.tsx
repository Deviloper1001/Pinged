"use client"

import { useState } from "react"
import { useChat } from "@/lib/chat-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { Wordmark } from "@/components/brand"
import { Loader2, LockKeyhole, AlertTriangle } from "lucide-react"

// Shown when the browser has a valid session cookie but the private key is not
// in memory (e.g. after a page refresh). Re-enter the password to unlock — the
// key is only ever held in memory for the session.
export function UnlockScreen() {
  const user = useChat((s) => s.user)
  const unlock = useChat((s) => s.unlock)
  const logout = useChat((s) => s.logout)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await unlock(password)
    setBusy(false)
    if (res.error) setError(res.error)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-accent/40">
      <Card className="w-full max-w-sm shadow-lg border-border/60">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <CardDescription className="text-sm">
            Unlock your encryption key, <span className="font-medium text-foreground">{user?.username}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                autoFocus
                placeholder="enter your password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5" role="alert">
                <AlertTriangle className="h-4 w-4" /> {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy || !password}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              Unlock
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => void logout()}
              disabled={busy}
            >
              Sign out instead
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            Your private key never leaves this browser. Re-entering your
            password re-derives the key locally so chats can be decrypted.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
