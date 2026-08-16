"use client"

import { useProtectedPage } from "@/hooks/useProtectedPage"
import { PwaComingSoon } from "../../components/PwaComingSoon"
import { ListChecks } from "lucide-react"

export default function PwaCreateNominationPage() {
  useProtectedPage()
  return (
    <PwaComingSoon
      icon={ListChecks}
      title="Open Nomination"
      phase="Phase 3"
      blurb="Same nomination config flow, restyled in glass"
    />
  )
}
