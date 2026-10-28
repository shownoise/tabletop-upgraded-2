"use client"

import { useEffect, useRef, useState } from "react"
import type { LiveEvent, PublicState } from "./types"

export interface SessionStream {
  state: PublicState
  connected: boolean
  /** True once the poll endpoint has returned 401 — session is no longer valid. */
  expired: boolean
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
/**
 * `as: "participant"` vraagt expliciet om de deelnemer-projectie, ook als deze
 * browser een facilitator-cookie heeft.
 *
 * Waarom dat nodig is: beide routes gaven een ingelogde facilitator altijd de
 * volledige sessie, en de volledige sessie heeft geen `activeDecision` — dat
 * veld maakt de projectie. Een facilitator die in zijn eigen browser als
 * deelnemer meeliep zag op /play dus "de facilitator heeft de keuze nog niet
 * opengezet", terwijl hij zelf op fase 'beslissing' stond en op vier rollen
 * wachtte. Precies de manier waarop dit product solo getest wordt.
 *
 * Alleen de rol omdraaien kon niet: deze hook stuurt `participantId` uit
 * localStorage altijd mee, ook op het facilitatordashboard. Dan zou dát scherm
 * de deelnemer-projectie krijgen zodra je ooit hebt meegedaan.
 */
export function useSessionStream(opties: { as?: "participant" | "facilitator" } = {}): SessionStream {
  const alsDeelnemer = opties.as === "participant"
  const [state, setState] = useState<PublicState>({ session: null })
  const [connected, setConnected] = useState(false)
  const [expired, setExpired] = useState(false)
  const listenersRef = useRef<Set<(e: LiveEvent) => void>>(new Set())
  const lastSeenRef = useRef<number>(Date.now())

  useEffect(() => {
    // Phase 6 — attach participantId (if any) so the SSE + poll projections
    // can narrow participantViewState to this participant's own subtree.
    const participantId = (typeof window !== "undefined")
      ? window.localStorage.getItem("ctt:participantId") ?? undefined
      : undefined
    const params = new URLSearchParams()
    if (participantId) params.set("participantId", participantId)
    if (alsDeelnemer) params.set("as", "participant")
    const qs = params.size > 0 ? `?${params}` : ""
    const es = new EventSource(`/api/events${qs}`)

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
    // Poll every 2 s to keep participants close to server truth during active rounds.
    // Log every ~30th failure so we notice a sustained network outage without spamming the console.
    let pollFailureCount = 0
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/session/state${qs}`, { cache: "no-store" })
        if (res.status === 401) {
          setExpired(true)
          setConnected(false)
          return
        }
        if (res.ok) {
          const data = await res.json() as PublicState
          setState(data)
          pollFailureCount = 0
        }
      } catch (err) {
        pollFailureCount += 1
        if (pollFailureCount === 1 || pollFailureCount % 30 === 0) {
          console.warn("[ctt] session-state poll failed", pollFailureCount, err)
        }
      }
    }, 2000)

    return () => {
      es.removeEventListener("state", handleState)
      es.removeEventListener("event", handleEvent)
      es.removeEventListener("open", handleOpen)
      es.removeEventListener("error", handleError)
      es.close()
      clearInterval(poll)
    }
  }, [alsDeelnemer])

  return {
    state,
    connected,
    expired,
    onEvent: (cb) => {
      listenersRef.current.add(cb)
      return () => {
        listenersRef.current.delete(cb)
      }
    },
  }
}
