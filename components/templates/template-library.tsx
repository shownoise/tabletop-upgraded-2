"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Plus, Download, Upload, Trash2, Tag,
  Clock, ChevronRight, Shield, Layers, Zap, Search
} from "lucide-react"
import type { ScenarioTemplate, TemplateTag, DifficultyLevel } from "@/lib/template-types"
import { loadLibrary, deleteTemplate, exportTemplate, importTemplate, addTemplate } from "@/lib/template-store"
import { useLang } from "@/lib/use-lang"

const TAG_COLORS: Record<string, string> = {
  ransomware: "border-red-500/40 bg-red-500/10 text-red-400",
  "insider-threat": "border-orange-500/40 bg-orange-500/10 text-orange-400",
  "supply-chain": "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  bec: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  ddos: "border-purple-500/40 bg-purple-500/10 text-purple-400",
  nis2: "border-green-500/40 bg-green-500/10 text-green-400",
  gdpr: "border-green-500/40 bg-green-500/10 text-green-400",
  tabletop: "border-border bg-card text-muted-foreground",
  technical: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
  executive: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  beginner: "border-border bg-muted/20 text-muted-foreground",
  intermediate: "border-primary/40 bg-primary/10 text-primary",
  advanced: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  expert: "border-red-500/40 bg-red-500/10 text-red-400",
}

const DIFFICULTY_ICONS: Record<DifficultyLevel, string> = {
  beginner: "▪",
  intermediate: "▪▪",
  advanced: "▪▪▪",
  expert: "▪▪▪▪",
}

function TemplateCard({ template, onDelete, onExport, onUse }: {
  template: ScenarioTemplate
  onDelete: () => void
  onExport: () => void
  onUse: () => void
}) {
  const isBuiltin = template.id.startsWith("builtin-")
  return (
    <div className="group flex flex-col gap-0 rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors">
      {/* Header strip */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/40">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {DIFFICULTY_ICONS[template.difficulty]} {template.difficulty}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">·</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {template.contentMode}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">v{template.version}</span>
      </div>

      <div className="flex flex-col gap-3 px-5 py-4 flex-1">
        {/* Operation name */}
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary">{template.operationName}</div>

        {/* Name */}
        <h3 className="font-mono text-base font-bold text-foreground leading-tight">{template.name}</h3>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{template.description}</p>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
          <span className="flex items-center gap-1"><Layers className="size-3" /> {template.rounds.length} rounds</span>
          <span className="flex items-center gap-1"><Clock className="size-3" /> {template.estimatedDurationMinutes}m</span>
          {template.author && <span className="truncate">{template.author}</span>}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {template.tags.slice(0, 5).map(tag => (
            <span key={tag} className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border ${TAG_COLORS[tag] ?? "border-border bg-card text-muted-foreground"}`}>
              {tag}
            </span>
          ))}
          {isBuiltin && (
            <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
              BUILTIN
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-background/20">
        <button onClick={onUse} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 border border-primary/30 px-3 py-2 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors">
          <Zap className="size-3" /> Use template
        </button>
        <button onClick={onExport} className="rounded-lg border border-border bg-card px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">
          <Download className="size-3.5" />
        </button>
        {!isBuiltin && (
          <button onClick={onDelete} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive/70 hover:text-destructive transition-colors">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export function TemplateLibrary() {
  const [lang] = useLang()
  const router = useRouter()
  const [templates, setTemplates] = useState<ScenarioTemplate[]>([])
  const [search, setSearch] = useState("")
  const [filterTag, setFilterTag] = useState<TemplateTag | "">("")
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const lib = loadLibrary()
    setTemplates(lib.templates)
  }, [])

  const filtered = templates.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
    const matchTag = !filterTag || t.tags.includes(filterTag as TemplateTag)
    return matchSearch && matchTag
  })

  const allTags = [...new Set(templates.flatMap(t => t.tags))].sort()

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const t = await importTemplate(file)
      const lib = addTemplate(t)
      setTemplates(lib.templates)
    } catch (err) {
      alert("Invalid template file")
    }
    if (importRef.current) importRef.current.value = ""
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return
    const lib = deleteTemplate(id)
    setTemplates(lib.templates)
  }

  function handleUse(template: ScenarioTemplate) {
    // Store selected template and redirect to admin setup
    try { localStorage.setItem("ctt:selected-template", JSON.stringify(template)) } catch {}
    router.push("/admin")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex size-8 items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Template Library</span>
              <span className="font-mono text-sm text-foreground">{templates.length} templates</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            <button onClick={() => importRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
              <Upload className="size-3.5" /> Import
            </button>
            <Link href="/templates/builder" className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors">
              <Plus className="size-3.5" /> New template
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 flex flex-col gap-6">
        {/* Search + filter */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2.5 font-mono text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/40"
            />
          </div>
          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value as TemplateTag | "")}
            className="rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-muted-foreground focus:outline-none focus:border-primary/40"
          >
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card/50 py-16 text-center">
            <Shield className="size-10 text-muted-foreground" />
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">No templates found</p>
            <Link href="/templates/builder" className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors">
              <Plus className="size-3.5" /> Create first template
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                onDelete={() => handleDelete(t.id)}
                onExport={() => exportTemplate(t)}
                onUse={() => handleUse(t)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
