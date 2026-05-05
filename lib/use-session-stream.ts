"use client"

import { useEffect, useRef, useState } from "react"
import type { LiveEvent, PublicState } from "./types"

export interface SessionStream {
  state: PublicState
  connected: boolean
  /** Subscribe to live (transient) events. Returns an unsubscribe fn. */
  onEvent: (cb: (e: LiveEvent) => void) => () => void
}

/**
 * Subscribes to the server-sent event stream and exposes:
 *  - the latest full state snapshot
 *  - a connection flag
 *  - an event subscription helper for transient notifications
 *    (popups, alerts, etc.) that should not be re-played on reconnect.
 */
export function useSessionStream(): SessionStream {
  const [state, setState] = useState<PublicState>({ session: null })
  const [connected, setConnected] = useState(false)
  const listenersRef = useRef<Set<(e: LiveEvent) => void>>(new Set())
  const lastSeenRef = useRef<number>(Date.now())

  useEffect(() => {
    const es = new EventSource("/api/events")

    const handleState = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as PublicState
        setState(data)
        lastSeenRef.current = Date.now()
      } catch (err) {
        console.log("[ctt] failed to parse state", err)
      }
    }

    const handleEvent = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as LiveEvent
        lastSeenRef.current = Date.now()
        for (const cb of listenersRef.current) cb(data)
      } catch (err) {
        console.log("[ctt] failed to parse event", err)
      }
    }

    const handleOpen = () => setConnected(true)
    const handleError = () => setConnected(false)

    es.addEventListener("state", handleState)
    es.addEventListener("event", handleEvent)
    es.addEventListener("open", handleOpen)
    es.addEventListener("error", handleError)

    // Polling fallback — Vercel can route requests to different instances,
    // so SSE listeners on instance A miss mutations that happened on instance B.
    // Poll every 4 s to guarantee eventual consistency.
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/session/state", { cache: "no-store" })
        if (res.ok) {
          const data = await res.json() as PublicState
          setState(data)
        }
      } catch { /* silently ignore */ }
    }, 4000)

    return () => {
      es.removeEventListener("state", handleState)
      es.removeEventListener("event", handleEvent)
      es.removeEventListener("open", handleOpen)
      es.removeEventListener("error", handleError)
      es.close()
      clearInterval(poll)
    }
  }, [])

  return {
    state,
    connected,
    onEvent: (cb) => {
      listenersRef.current.add(cb)
      return () => {
        listenersRef.current.delete(cb)
      }
    },
  }
}
