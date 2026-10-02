"use client"

import { useRef, useState } from "react"
import { useChat } from "@/lib/chat-store"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { VoiceRecorder } from "./VoiceRecorder"
import { getSocket } from "@/lib/socket-client"
import { ImagePlus, SendHorizonal, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function MessageComposer() {
  const sendText = useChat((s) => s.sendText)
  const sendMedia = useChat((s) => s.sendMedia)
  const conv = useChat((s) => s.selectedConv)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)

  function emitTyping(isTyping: boolean) {
    try {
      getSocket().emit("typing", { conversation: conv, isTyping })
      isTypingRef.current = isTyping
    } catch {}
  }

  function onTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    if (!isTypingRef.current) emitTyping(true)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => emitTyping(false), 2500)
  }

  async function send() {
    const t = text.trim()
    if (!t || sending) return
    if (isTypingRef.current) emitTyping(false)
    setSending(true)
    setText("")
    const res = await sendText(t)
    setSending(false)
    if (res.error) {
      setText(t)
      toast.error(res.error)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    const res = await sendMedia(file, "image")
    setUploading(false)
    if (res.error) toast.error(res.error)
  }

  async function onVoice(blob: Blob) {
    setUploading(true)
    const res = await sendMedia(blob, "voice")
    setUploading(false)
    if (res.error) toast.error(res.error)
  }

  return (
    <div className="border-t bg-card/80 backdrop-blur px-3 py-3 sm:px-4">
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickImage}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Send image"
          title="Send image"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <VoiceRecorder onRecorded={onVoice} disabled={uploading} />
        <div className="flex-1 min-w-0">
          <Textarea
            value={text}
            onChange={onTextChange}
            onKeyDown={onKeyDown}
            placeholder="Type an encrypted message…"
            rows={1}
            className="resize-none min-h-[40px] max-h-32 bg-background border-border/70 focus-visible:ring-primary/40 scroll-thin"
          />
        </div>
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 rounded-full shrink-0"
          onClick={send}
          disabled={(!text.trim() && !uploading) || sending || uploading}
          aria-label="Send message"
        >
          {sending || uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
