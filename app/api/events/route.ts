import { auth } from "@/auth"
import { getState, subscribe, subscribeParticipant } from "@/lib/session-store"
import type { StreamMessage } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request): Promise<Response> {
  // Admins/facilitators get the full state (facilitator notes, flags, etc.)
  // Participants get a stripped view — no hints, no answer metadata, no future rounds
  const session = await auth()
  const isAdmin = !!session?.user

  const url = new URL(req.url)
  const participantId = url.searchParams.get("participantId") ?? undefined
  // Zie /api/session/state: de deelnemerpagina vraagt expliciet om haar eigen
  // projectie, zodat een facilitator die in dezelfde browser meeloopt niet de
  // volledige sessie (zonder `activeDecision`) binnenkrijgt.
  const alsDeelnemer = url.searchParams.get("as") === "participant"
  const volledigeStaat = isAdmin && !alsDeelnemer
  // Same membership rule as /api/session/state: the participant projection
  // carries the join code and client context, so an anonymous subscriber may
  // not open a stream of it. Only enforced once a session exists — before that
  // there is nothing to leak and the lobby still needs to connect.
  if (!isAdmin) {
    const { session: live } = await getState()
    if (live && !(participantId && live.participants.some(p => p.id === participantId))) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const safeEnqueue = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closed = true
        }
      }

      const send = (msg: StreamMessage) => {
        safeEnqueue(`event: ${msg.type}\n`)
        safeEnqueue(`data: ${JSON.stringify(msg.data)}\n\n`)
      }

      // Participant-scoped SSE: the participantId narrows participantViewState
      // to just this participant's own entry.
      const unsubscribe = volledigeStaat ? subscribe(send) : subscribeParticipant(send, participantId)

      const heartbeat = setInterval(() => {
        safeEnqueue(`: hb ${Date.now()}\n\n`)
      }, 15000)

      const cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* ignore */
        }
      }

      req.signal.addEventListener("abort", cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
