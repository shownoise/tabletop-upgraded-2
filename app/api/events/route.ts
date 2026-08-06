import { auth } from "@/auth"
import { subscribe, subscribeParticipant } from "@/lib/session-store"
import type { StreamMessage } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request): Promise<Response> {
  // Admins/facilitators get the full state (facilitator notes, flags, etc.)
  // Participants get a stripped view — no hints, no answer metadata, no future rounds
  const session = await auth()
  const isAdmin = !!session?.user

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

      // Participant-scoped SSE: pass the participantId query so the projection
      // narrows participantViewState to just this participant's own entry.
      const url = new URL(req.url)
      const participantId = url.searchParams.get("participantId") ?? undefined
      const unsubscribe = isAdmin ? subscribe(send) : subscribeParticipant(send, participantId)

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
