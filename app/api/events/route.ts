import { subscribe } from "@/lib/session-store"
import type { StreamMessage } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request): Promise<Response> {
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

      const unsubscribe = subscribe(send)

      // periodic comment line keeps proxies from closing the stream
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

      // close when client disconnects
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
