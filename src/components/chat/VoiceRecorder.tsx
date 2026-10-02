"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  onRecorded: (blob: Blob) => void
  disabled?: boolean
}

export function VoiceRecorder({ onRecorded, disabled }: Props) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function start() {
    setError(null)
    setRequesting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        onRecorded(blob)
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      mr.start()
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch (e) {
      setError(
        "Microphone access denied. Please allow mic permissions and try again.",
      )
    } finally {
      setRequesting(false)
    }
  }

  function stop() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    mediaRef.current?.stop()
    setRecording(false)
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5">
        <span className="flex items-end gap-0.5 h-4">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="eq-bar w-1 rounded-full bg-destructive"
              style={{ height: "100%", animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        <span className="text-xs font-medium text-destructive tabular-nums">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="h-7 w-7 rounded-full"
          onClick={stop}
          aria-label="Stop recording"
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-destructive hidden sm:inline">{error}</span>
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn("h-9 w-9 rounded-full text-muted-foreground hover:text-primary", requesting && "opacity-60")}
        onClick={start}
        disabled={disabled || requesting}
        aria-label="Record voice note"
        title="Record voice note"
      >
        {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
      </Button>
    </div>
  )
}
