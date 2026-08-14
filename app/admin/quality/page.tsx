import { AdminShell } from "@/components/admin/hub/shell"
import { QualityScorer } from "@/components/admin/hub/quality-scorer"

export const dynamic = "force-dynamic"

export default function QualityPage() {
  return (
    <AdminShell breadcrumbs={[{ label: "Kwaliteit" }]}>
      <QualityScorer />
    </AdminShell>
  )
}
