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

  useEffect(() => {
    const es = new EventSource("/api/events")

    const handleState = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as PublicState
        setState(data)
      } catch (err) {
        console.log("[v0] failed to parse state", err)
      }
    }

    const handleEvent = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as LiveEvent
        for (const cb of listenersRef.current) cb(data)
      } catch (err) {
        console.log("[v0] failed to parse event", err)
      }
    }

    const handleOpen = () => setConnected(true)
    const handleError = () => setConnected(false)

    es.addEventListener("state", handleState)
    es.addEventListener("event", handleEvent)
    es.addEventListener("open", handleOpen)
    es.addEventListener("error", handleError)

    return () => {
      es.removeEventListener("state", handleState)
      es.removeEventListener("event", handleEvent)
      es.removeEventListener("open", handleOpen)
      es.removeEventListener("error", handleError)
      es.close()
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
