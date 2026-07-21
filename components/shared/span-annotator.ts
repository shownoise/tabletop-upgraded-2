import type { FactCheckTag, InjectReliability } from "@/lib/types"

export interface SelectionRange {
  start: number
  end: number
}

export interface SpanSegment<T extends FactCheckTag | InjectReliability> {
  start: number
  end: number
  annotationId?: string
  tag?: T
}

export function getSelectionRange(root: HTMLElement | null): SelectionRange | null {
  if (!root) return null
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const preRange = range.cloneRange()
  preRange.selectNodeContents(root)
  preRange.setEnd(range.startContainer, range.startOffset)
  const start = preRange.toString().length
  const end = start + range.toString().length
  if (end <= start) return null
  return { start, end }
}

export function splitTextByAnnotations<T extends FactCheckTag | InjectReliability>(
  content: string,
  annotations: Array<{ id: string; start: number; end: number; tag: T }>,
): SpanSegment<T>[] {
  const sorted = [...annotations].sort((a, b) => a.start - b.start)
  const segs: SpanSegment<T>[] = []
  let cursor = 0
  for (const a of sorted) {
    if (a.start > cursor) segs.push({ start: cursor, end: a.start })
    segs.push({ start: Math.max(a.start, cursor), end: a.end, annotationId: a.id, tag: a.tag })
    cursor = Math.max(cursor, a.end)
  }
  if (cursor < content.length) segs.push({ start: cursor, end: content.length })
  return segs
}

export function selectionRectRelativeTo(root: HTMLElement | null): { x: number; y: number } | null {
  if (!root) return null
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  return { x: rect.left - rootRect.left + rect.width / 2, y: rect.top - rootRect.top - 8 }
}
