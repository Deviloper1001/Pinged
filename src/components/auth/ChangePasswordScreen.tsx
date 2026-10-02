"use client"

import { useState } from "react"
import { useChat } from "@/lib/chat-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { Wordmark } from "@/components/brand"
import { Loader2, KeyRound, AlertTriangle } from "lucide-react"

export function ChangePasswordScreen() {
  const user = useChat((s) => s.user)
  const pendingTemp = useChat((s) => s.pendingTempPassword)
  const completeFirstLogin = useChat((s) => s.completeFirstLogin)

  const [current, setCurrent] = useState(pendingTemp ?? "")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (next !== confirm) {
      setError("Passwords do not match")
      return
    }
    setBusy(true)
    setError(null)
    const res = await completeFirstLogin(current, next)
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
            Welcome, <span className="font-medium text-foreground">{user?.username}</span>.
            Set a new password to finish setting up your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {!pendingTemp && (
              <div className="space-y-2">
                <Label htmlFor="current">Temporary password</Label>
                <Input
                  id="current"
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  disabled={busy}
                  autoFocus
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="next">New password</Label>
              <Input
                id="next"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                disabled={busy}
                autoFocus={!!pendingTemp}
                placeholder="anything you like"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              No password restrictions — pick something memorable. Your new
              password unlocks your private encryption key, generated locally in
              this browser.
            </p>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5" role="alert">
                <AlertTriangle className="h-4 w-4" /> {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy || !current || !next || !confirm}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Set password &amp; continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
