import { AdminShell } from "@/components/admin/hub/shell"
import { SessionsList } from "@/components/admin/hub/sessions-list"

export const dynamic = "force-dynamic"

export default function SessionsPage() {
  return (
    <AdminShell breadcrumbs={[{ label: "Sessies" }]}>
      <SessionsList />
    </AdminShell>
  )
}
