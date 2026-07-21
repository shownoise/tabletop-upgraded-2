"use client"

import dynamic from "next/dynamic"

const BuilderCanvas = dynamic(() => import("@/components/admin/builder/canvas"), { ssr: false })

export default function BuilderPage() {
  return <BuilderCanvas />
}
