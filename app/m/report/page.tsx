"use client"

import { useProtectedPage } from "@/hooks/useProtectedPage"
import { PwaComingSoon } from "../components/PwaComingSoon"
import { BarChart2 } from "lucide-react"

export default function PwaReportPage() {
  useProtectedPage()
  return (
    <PwaComingSoon
      icon={BarChart2}
      title="Report"
      phase="Phase 5"
      blurb="Merch / Events pill switcher, backed by the report API"
    />
  )
}
