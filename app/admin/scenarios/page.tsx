import { AdminShell } from "@/components/admin/hub/shell"
import { ScenariosPanel } from "@/components/admin/hub/scenarios-panel"

export const dynamic = "force-dynamic"

export default function ScenariosPage() {
  return (
    <AdminShell breadcrumbs={[{ label: "Scenario's" }]}>
      <ScenariosPanel />
    </AdminShell>
  )
}
