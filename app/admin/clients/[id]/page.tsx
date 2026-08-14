import { AdminShell } from "@/components/admin/hub/shell"
import { ClientDetail } from "@/components/admin/hub/client-detail"

export const dynamic = "force-dynamic"

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <AdminShell breadcrumbs={[{ label: "Klanten", href: "/admin/clients" }, { label: id === "new" ? "Nieuwe klant" : "Klant" }]}>
      <ClientDetail id={id} />
    </AdminShell>
  )
}
