import { AdminShell } from "@/components/admin/hub/shell"
import { SettingsHub } from "@/components/admin/hub/settings-hub"

export const dynamic = "force-dynamic"

export default function SettingsPage() {
  return (
    <AdminShell breadcrumbs={[{ label: "Instellingen" }]}>
      <SettingsHub />
    </AdminShell>
  )
}
