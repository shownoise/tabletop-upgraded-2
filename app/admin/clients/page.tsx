import { AdminShell } from "@/components/admin/hub/shell"
import { ClientsList } from "@/components/admin/hub/clients-list"

export const dynamic = "force-dynamic"

export default function ClientsPage() {
  return (
    <AdminShell breadcrumbs={[{ label: "Klanten" }]}>
      <ClientsList />
    </AdminShell>
  )
}
