"use client"

import { useEffect, useState } from "react"
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
import { Loader2, UserCog } from "lucide-react"
import { toast } from "sonner"

export function EditProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const user = useChat((s) => s.user)
  const updateProfile = useChat((s) => s.updateProfile)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  // sync the field with the current display name whenever the dialog opens
  useEffect(() => {
    if (open) setName(user?.displayName ?? "")
  }, [open, user?.displayName])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const res = await updateProfile(name.trim())
    setBusy(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success("Profile updated")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" /> Edit profile
          </DialogTitle>
          <DialogDescription>
            Set a display name friends will see in chats. Leave it blank to use
            your username handle.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={user?.username ?? "your name"}
              maxLength={40}
              disabled={busy}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Username handle:{" "}
              <span className="font-mono text-foreground/80">@{user?.username}</span>
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
