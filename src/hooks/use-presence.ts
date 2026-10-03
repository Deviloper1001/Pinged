"use client"

import { useEffect, useRef } from "react"
import { apiPost } from "@/lib/api-client"

type Setter = (ids: string[]) => void

/**
 * Heartbeat-based presence on serverless. POSTs a heartbeat every 20s and
 * fetches the online list every 15s. Not as tight as a socket connection but
 * perfectly fine for a small friend group.
 */
export function usePresence(myId: string | undefined, setOnline: Setter) {
  const setOnlineRef = useRef(setOnline)
  // Update the ref inside an effect so it's never mutated during render.
  useEffect(() => {
    setOnlineRef.current = setOnline
  })

  useEffect(() => {
    if (!myId) return
    let cancelled = false

    // initial fetch
    void (async () => {
      try {
        const r = await fetch("/api/presence", { credentials: "include" })
        if (!cancelled && r.ok) {
          const { online } = (await r.json()) as { online: string[] }
          setOnlineRef.current(online)
        }
      } catch {}
    })()

    const fetchTimer = setInterval(async () => {
      try {
        const r = await fetch("/api/presence", { credentials: "include" })
        if (!cancelled && r.ok) {
          const { online } = (await r.json()) as { online: string[] }
          setOnlineRef.current(online)
        }
      } catch {}
    }, 15_000)

    const beatTimer = setInterval(() => {
      void apiPost("/api/presence", {})
    }, 20_000)
    // send an immediate beat on mount
    void apiPost("/api/presence", {})

    return () => {
      cancelled = true
      clearInterval(fetchTimer)
      clearInterval(beatTimer)
    }
  }, [myId])
}
