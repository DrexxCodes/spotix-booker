"use client"

import { useProtectedPage } from "@/hooks/useProtectedPage"
import { PwaComingSoon } from "../../components/PwaComingSoon"
import { CalendarPlus } from "lucide-react"

export default function PwaCreateEventPage() {
  useProtectedPage()
  return (
    <PwaComingSoon
      icon={CalendarPlus}
      title="Create Event"
      phase="Phase 3"
      blurb="Same multi-step flow as create-event/page.tsx, restyled in glass"
    />
  )
}
