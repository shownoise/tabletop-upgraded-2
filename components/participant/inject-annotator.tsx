"use client"

import { useEffect, useRef, useState } from "react"
import type { FactCheckTag } from "@/lib/types"
import { api } from "@/lib/api-client"

interface Annotation {
  id: string
  start: number
  end: number
  tag: FactCheckTag
}

interface Props {
  injectId: string
  participantId: string
  content: string
  annotations: Annotation[]
}

const UNDERLINE_CLASS: Record<FactCheckTag, string> = {
  fact:       "decoration-emerald-500/60",
  assumption: "decoration-yellow-500/60",
  misleading: "decoration-red-500/60",
}

const DOT_CLASS: Record<FactCheckTag, string> = {
  fact:       "bg-emerald-500",
  assumption: "bg-yellow-500",
  misleading: "bg-red-500",
}

export function InjectAnnotator({ injectId, participantId, content, annotations }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [toolbar, setToolbar] = useState<{ x: number; y: number; start: number; end: number } | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setToolbar(null)
        setShowHelp(false)
        window.getSelection()?.removeAllRanges()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function handleMouseUp() {
    const root = rootRef.current
    if (!root) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setToolbar(null)
      return
    }
    const range = selection.getRangeAt(0)
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
      setToolbar(null)
      return
    }
    const preRange = range.cloneRange()
    preRange.selectNodeContents(root)
    preRange.setEnd(range.startContainer, range.startOffset)
    const start = preRange.toString().length
    const end = start + range.toString().length
    if (end <= start) { setToolbar(null); return }
    const rect = range.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    setToolbar({
      x: rect.left - rootRect.left + rect.width / 2,
      y: rect.top - rootRect.top - 8,
      start,
      end,
    })
  }

  async function annotate(tag: FactCheckTag) {
    if (!toolbar) return
    try {
      await api.addAnnotation({ participantId, injectId, start: toolbar.start, end: toolbar.end, tag })
    } catch {}
    setToolbar(null)
    window.getSelection()?.removeAllRanges()
  }

  async function removeAnn(id: string) {
    setRemoving(id)
    try { await api.removeAnnotation({ participantId, annotationId: id }) }
    catch {}
    finally { setRemoving(null) }
  }

  const sorted = [...annotations].sort((a, b) => a.start - b.start)
  const segs: Array<{ start: number; end: number; annotationId?: string; tag?: FactCheckTag }> = []
  let cursor = 0
  for (const a of sorted) {
    if (a.start > cursor) segs.push({ start: cursor, end: a.start })
    segs.push({ start: Math.max(a.start, cursor), end: a.end, annotationId: a.id, tag: a.tag })
    cursor = Math.max(cursor, a.end)
  }
  if (cursor < content.length) segs.push({ start: cursor, end: content.length })

  return (
    <div className="relative" ref={rootRef} onMouseUp={handleMouseUp}>
      <div className="whitespace-pre-wrap">
        {segs.map((seg, i) => {
          const slice = content.slice(seg.start, seg.end)
          if (!seg.tag || !seg.annotationId) return <span key={i}>{slice}</span>
          const cls = UNDERLINE_CLASS[seg.tag]
          const disabled = removing === seg.annotationId
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); removeAnn(seg.annotationId!) }}
              disabled={disabled}
              className={`underline decoration-2 ${cls} cursor-pointer bg-transparent p-0 text-inherit font-inherit`}
              title="Klik om markering te verwijderen"
            >
              {slice}
            </button>
          )
        })}
      </div>
      {toolbar && (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-tt-border bg-tt-surface shadow-md flex items-center gap-1 px-1.5 py-1"
          style={{ left: toolbar.x, top: toolbar.y }}
        >
          {(["fact", "assumption", "misleading"] as FactCheckTag[]).map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => annotate(tag)}
              className={`size-4 rounded-full ${DOT_CLASS[tag]} hover:scale-110 transition-transform`}
              title={tag}
              aria-label={tag}
            />
          ))}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowHelp(v => !v) }}
            className="ml-1 flex size-4 items-center justify-center rounded-full border border-tt-border text-[9px] text-tt-dim hover:text-tt-bright"
            aria-label="Uitleg"
          >
            ?
          </button>
          {showHelp && (
            <span className="absolute -bottom-6 left-0 whitespace-nowrap rounded border border-tt-border bg-tt-surface px-2 py-0.5 text-[10px] text-tt-dim shadow">
              Markeer een woord of zin die je verdacht vindt
            </span>
          )}
        </div>
      )}
    </div>
  )
}
