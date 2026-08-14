import { AdminShell } from "@/components/admin/hub/shell"
import { SessionDetail } from "@/components/admin/hub/session-detail"

export const dynamic = "force-dynamic"

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <AdminShell breadcrumbs={[{ label: "Sessies", href: "/admin/sessions" }, { label: "Details" }]}>
      <SessionDetail id={id} />
    </AdminShell>
  )
}
