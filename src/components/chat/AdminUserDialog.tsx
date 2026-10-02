"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useChat } from "@/lib/chat-store"
import { apiPost } from "@/lib/api-client"
import { toast } from "sonner"
import { Loader2, UserPlus, Copy, Check } from "lucide-react"

export function AdminUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const loadUsers = useChat((s) => s.loadUsers)
  const [username, setUsername] = useState("")
  const [tempPassword, setTempPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setUsername("")
    setTempPassword("")
    setCreated(null)
    setCopied(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await apiPost("/api/users", {
        username: username.trim().toLowerCase(),
        tempPassword,
      })
      await loadUsers()
      setCreated({ username: username.trim().toLowerCase(), password: tempPassword })
      setUsername("")
      setTempPassword("")
      toast.success("Account created")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create account")
    } finally {
      setBusy(false)
    }
  }

  async function copyCreds() {
    if (!created) return
    await navigator.clipboard.writeText(
      `pinged login\nusername: ${created.username}\npassword: ${created.password}\n(you'll be asked to change this on first login)`,
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) setTimeout(reset, 200)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Create a member account
          </DialogTitle>
          <DialogDescription>
            Only the admin can create accounts. The new member gets a temporary
            password they must change on first login (which also generates their
            encryption key in their own browser).
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm">
              Share these temporary credentials with{" "}
              <span className="font-medium">{created.username}</span>:
            </p>
            <div className="rounded-md bg-background p-3 text-sm font-mono space-y-1">
              <div>username: {created.username}</div>
              <div>password: {created.password}</div>
            </div>
            <Button variant="outline" className="w-full" onClick={copyCreds}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy credentials"}
            </Button>
            <Button
              className="w-full"
              onClick={() => {
                onOpenChange(false)
                setTimeout(reset, 200)
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. sam"
                disabled={busy}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temp-pw">Temporary password</Label>
              <Input
                id="temp-pw"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="one-time password"
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                No restrictions. The user must change it on first login.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || !username || !tempPassword}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create account
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
