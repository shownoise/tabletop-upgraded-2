import { redirect } from "next/navigation"

// Consolidated to the classic /admin/dashboard — it has the mature inject
// controls, specials panel, timeline, and scoring UI. The narrative "story"
// view is kept as source but not user-facing.
export default function AdminStoryPage() {
  redirect("/admin/dashboard")
}
