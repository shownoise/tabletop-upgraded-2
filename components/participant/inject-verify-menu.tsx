"use client"

import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { FactCheckTag } from "@/lib/types"

interface Props {
  currentTag?: FactCheckTag
  disabled?: boolean
  onTag: (tag: FactCheckTag) => void | Promise<void>
}

const TAG_META: Record<FactCheckTag, { label: string; help: string; color: string; dot: string }> = {
  fact:       { label: "Feit",       help: "Ik heb dit geverifieerd of vertrouw de bron", color: "text-emerald-500", dot: "bg-emerald-500" },
  assumption: { label: "Aanname",    help: "Plausibel maar niet gecheckt",                 color: "text-yellow-500",  dot: "bg-yellow-500" },
  misleading: { label: "Misleidend", help: "Ik denk dat dit niet klopt",                   color: "text-red-500",     dot: "bg-red-500" },
}

export function InjectVerifyMenu({ currentTag, disabled, onTag }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function pick(tag: FactCheckTag) {
    if (busy || disabled) return
    setBusy(true)
    try {
      await onTag(tag)
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const dotClass = currentTag ? TAG_META[currentTag].dot : "bg-transparent"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`relative inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${
            currentTag ? "border-tt-accent/40 text-tt-accent" : "border-tt-border text-tt-dim hover:text-tt-bright"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-label="Verify"
        >
          <ShieldCheck className="size-3" />
          <span>Verify</span>
          {currentTag && (
            <span className={`inline-block size-1.5 rounded-full ${dotClass}`} />
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
