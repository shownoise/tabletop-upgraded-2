"use client"

import { usePathname } from "next/navigation"
import { EyeHeader } from "./eye-header"

export function AppHeader() {
  const pathname = usePathname()

  if (pathname?.startsWith("/admin")) return null

  return <EyeHeader />
}
