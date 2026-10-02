"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useChat } from "@/lib/chat-store"
import { ShieldAlert, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function ManageMembersDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const users = useChat((s) => s.users)
  const me = useChat((s) => s.user)
  const deleteAccount = useChat((s) => s.deleteAccount)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // members excluding the admin (admin can't be deleted here)
  const members = users.filter((u) => !u.isAdmin)

  async function doDelete(id: string) {
    setDeletingId(id)
    const res = await deleteAccount(id)
    setDeletingId(null)
    if (res.error) toast.error(res.error)
    else toast.success("Account deleted")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> Manage members
          </DialogTitle>
          <DialogDescription>
            Remove accounts from this group. Deleting an account also erases the
            messages they sent. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No members to manage yet. Use{" "}
            <span className="font-medium text-foreground">Create account</span>{" "}
            to add people.
          </p>
        ) : (
          <ScrollArea className="max-h-80 scroll-thin">
            <ul className="space-y-1 pr-1">
              {members.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">
                      {u.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{u.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.publicKey
                        ? u.mustChangePassword
                          ? "needs to set up their key"
                          : "active"
                        : "needs setup"}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === u.id}
                        aria-label={`Delete ${u.username}`}
                      >
                        {deletingId === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {u.username}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Their account and all messages they sent will be
                          permanently removed. Other members will see them
                          disappear from the group.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingId === u.id}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => doDelete(u.id)}
                          disabled={deletingId === u.id}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          {deletingId === u.id ? "Deleting…" : "Delete account"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
          <ShieldAlert className="h-3.5 w-3.5" />
          Signed in as admin: <span className="font-medium text-foreground">{me?.username}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
