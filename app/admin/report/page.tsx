import Link from "next/link"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { ReportViewWrapper } from "@/components/admin/report-view-wrapper"

export default function AdminReportPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 md:px-10">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-primary" />
            <span className="font-mono text-sm tracking-wider">REPORT</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-14">
        <ReportViewWrapper />
      </main>
    </div>
  )
}
