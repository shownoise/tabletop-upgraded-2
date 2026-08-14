"use client"

import { useEffect, useState } from "react"
import { CircleDot, ShieldCheck } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { FactCheckTag } from "@/lib/types"

interface Props {
  currentTag?: FactCheckTag
  disabled?: boolean
  onTag: (tag: FactCheckTag) => void | Promise<void>
  showFirstHint?: boolean
  onDismissHint?: () => void
}

const TAG_META: Record<FactCheckTag, { label: string; help: string; color: string; dot: string }> = {
  fact:       { label: "Feit",    help: "Ik heb dit geverifieerd of vertrouw de bron", color: "text-emerald-500", dot: "bg-emerald-500" },
  assumption: { label: "Aanname", help: "Plausibel maar niet gecheckt",                 color: "text-yellow-500",  dot: "bg-yellow-500" },
}

export function InjectVerifyMenu({ currentTag, disabled, onTag, showFirstHint, onDismissHint }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hintVisible, setHintVisible] = useState(!!showFirstHint)
  useEffect(() => { setHintVisible(!!showFirstHint) }, [showFirstHint])

  async function pick(tag: FactCheckTag) {
    if (busy || disabled) return
    setBusy(true)
    try {
      await onTag(tag)
      setOpen(false)
      if (hintVisible) { setHintVisible(false); onDismissHint?.() }
    } finally {
      setBusy(false)
    }
  }

  function handleTriggerClick() {
    if (hintVisible) { setHintVisible(false); onDismissHint?.() }
  }

  const meta = currentTag ? TAG_META[currentTag] : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={handleTriggerClick}
          aria-label={meta ? `Verifieer: ${meta.label}` : "Klik om te verifiëren"}
          className={`relative inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors ${
            meta ? "border-tt-border text-tt-dim" : "border-tt-border text-tt-dim hover:text-tt-bright"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {meta ? (
            <>
              <CircleDot className={`size-3 ${meta.color}`} />
              <span>{meta.label}</span>
            </>
          ) : (
            <>
              <ShieldCheck className="size-3" />
              <span>Verifieer</span>
            </>
          )}
          {hintVisible && !meta && (
            <span
              role="tooltip"
              aria-label="Klik om te verifiëren"
              className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-tt-accent/40 bg-tt-surface px-2 py-1 text-[10px] text-tt-accent shadow"
            >
              Klik om te verifiëren — waar of niet?
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <ul className="flex flex-col">
          {(Object.keys(TAG_META) as FactCheckTag[]).map(tag => {
            const meta = TAG_META[tag]
            const active = currentTag === tag
            return (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => pick(tag)}
                  disabled={busy}
                  className={`flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-tt-bright/5 ${
                    active ? "bg-tt-bright/5" : ""
                  }`}
                >
                  <span className={`mt-1 inline-block size-2 rounded-full ${meta.dot}`} />
                  <span className="flex flex-col">
                    <span className={`font-mono text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className="text-[10px] text-tt-dim leading-snug">{meta.help}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
