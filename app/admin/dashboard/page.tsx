import { redirect } from "next/navigation"

// Consolidated to a single live view — /admin/story is now the canonical
// facilitator control surface. Existing bookmarks / links redirect here.
export default function AdminDashboardPage() {
  redirect("/admin/story")
}
