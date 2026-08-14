import { AdminHub } from "@/components/admin/hub/tabs"

// Landing na login. Tabbed hub met vijf secties: scenario's, sessie starten,
// teksten, rollen, scoring. De losse setup-form die hier voorheen stond is
// nu de "Sessie starten"-tab.

export default function AdminPage() {
  return <AdminHub />
}
