import { redirect } from "next/navigation"

// /admin landt op /admin/clients. Klanten is de bovenlaag: van daar naar
// scenario's en sessies per klant. De oude tabbed hub is vervangen door
// echte routes (zie components/admin/hub/shell.tsx + de sub-pages).
export default function AdminPage() {
  redirect("/admin/clients")
}
