"use client"

import { useProtectedPage } from "@/hooks/useProtectedPage"
import { PwaComingSoon } from "../components/PwaComingSoon"
import { CalendarDays } from "lucide-react"

export default function PwaEventsPage() {
  useProtectedPage()
  return (
    <PwaComingSoon
      icon={CalendarDays}
      title="Events"
      phase="Phase 2"
      blurb="Event list + event-info (tabs & permissions) in glass"
    />
  )
}
