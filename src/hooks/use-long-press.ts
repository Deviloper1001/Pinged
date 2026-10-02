"use client"

import { useRef, useCallback } from "react"

type LongPressHandlers = {
  onTouchStart: () => void
  onTouchMove: () => void
  onTouchEnd: () => void
  onClick: (e: React.MouseEvent) => void
}

/**
 * Press-and-hold gesture for touch devices. Fires `callback` after `delay` ms
 * of continuous touch without scrolling. Cancels on move (scroll) or early
 * release. Also suppresses the synthetic click that fires right after a
 * long-press so the underlying element (e.g. an image link) isn't opened.
 *
 * Desktop mice are unaffected — touch handlers only fire on touch input.
 */
export function useLongPress(callback: () => void, delay = 450): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggered = useRef(false)

  const start = useCallback(() => {
    triggered.current = false
    timer.current = setTimeout(() => {
      triggered.current = true
      callback()
    }, delay)
  }, [callback, delay])

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const onClick = useCallback((e: React.MouseEvent) => {
    if (triggered.current) {
      e.preventDefault()
      e.stopPropagation()
      triggered.current = false
    }
  }, [])

  return {
    onTouchStart: start,
    onTouchMove: clear,
    onTouchEnd: clear,
    onClick,
  }
}
