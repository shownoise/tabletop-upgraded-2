"use client"

import { useLang } from "@/lib/use-lang"
import { ReportView } from "./report-view"

export function ReportViewWrapper() {
  const [lang] = useLang()
  return <ReportView lang={lang} />
}
