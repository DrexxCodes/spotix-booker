"use client"

import { useProtectedPage } from "@/hooks/useProtectedPage"
import { PwaComingSoon } from "../../components/PwaComingSoon"
import { Trophy } from "lucide-react"

export default function PwaCreatePollPage() {
  useProtectedPage()
  return (
    <PwaComingSoon
      icon={Trophy}
      title="Create Poll"
      phase="Phase 3"
      blurb="Same category/contestant flow as polls/create, restyled in glass"
    />
  )
}
