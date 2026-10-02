"use client"

import { useChat } from "@/lib/chat-store"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Wordmark } from "@/components/brand"
import { AdminUserDialog } from "./AdminUserDialog"
import { ManageMembersDialog } from "./ManageMembersDialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Users,
  LogOut,
  UserPlus,
  UserCog,
  Moon,
  Sun,
  ShieldAlert,
  Circle,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { useState } from "react"

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const user = useChat((s) => s.user)
  const users = useChat((s) => s.users)
  const selected = useChat((s) => s.selectedConv)
  const selectConv = useChat((s) => s.selectConv)
  const onlineIds = useChat((s) => s.onlineUserIds)
  const logout = useChat((s) => s.logout)
  const [adminOpen, setAdminOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  const others = users.filter((u) => u.id !== user?.id)

  return (
    <aside className="flex flex-col h-full w-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center justify-between gap-1 px-4 h-16 border-b border-sidebar-border shrink-0">
        <Wordmark />
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/70"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/70 md:hidden"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 scroll-thin">
        <div className="p-2 space-y-1">
          <ConvButton
            active={selected === "everyone"}
            onClick={() => selectConv("everyone")}
            icon={<Users className="h-4 w-4" />}
            label="Everyone"
            sub="Group chat"
          />
          <div className="px-2 pt-4 pb-1 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
            Direct messages
          </div>
          {others.length === 0 && (
            <p className="px-2 py-4 text-xs text-sidebar-foreground/50">
              No other members yet. {user?.isAdmin ? "Create one below." : "Ask the admin to add people."}
            </p>
          )}
          {others.map((u) => {
            const conv = `dm:${u.id}`
            const active = selected === conv
            const online = onlineIds.includes(u.id)
            const initials = u.username.slice(0, 2).toUpperCase()
            return (
              <button
                key={u.id}
                onClick={() => selectConv(conv)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
                )}
              >
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar",
                      online ? "bg-emerald-500" : "bg-muted-foreground/40",
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{u.username}</span>
                    {u.isAdmin && (
                      <ShieldAlert className="h-3 w-3 text-primary shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-sidebar-foreground/50">
                    {u.publicKey ? (online ? "online" : "offline") : "needs setup"}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-2 space-y-1 shrink-0">
        {user?.isAdmin && (
          <>
            <Button
              variant="outline"
              className="w-full justify-start border-dashed"
              onClick={() => setAdminOpen(true)}
            >
              <UserPlus className="h-4 w-4" /> Create account
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setManageOpen(true)}
            >
              <UserCog className="h-4 w-4" /> Manage members
            </Button>
          </>
        )}
        <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
        <div className="flex items-center gap-2 px-2 pt-1 text-xs text-sidebar-foreground/50">
          <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
          Signed in as <span className="font-medium text-sidebar-foreground/70">{user?.username}</span>
        </div>
      </div>

      <AdminUserDialog open={adminOpen} onOpenChange={setAdminOpen} />
      <ManageMembersDialog open={manageOpen} onOpenChange={setManageOpen} />
    </aside>
  )
}

function ConvButton({
  active,
  onClick,
  icon,
  label,
  sub,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  sub: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
        active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent/60",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full",
          active ? "bg-sidebar-primary-foreground/15" : "bg-primary/15 text-primary",
        )}
      >
        {icon}
      </span>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className={cn("text-xs", active ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/50")}>
          {sub}
        </div>
      </div>
    </button>
  )
}
