"use client"

import { useProtectedPage } from "@/hooks/useProtectedPage"
import { PwaComingSoon } from "../components/PwaComingSoon"
import { Vote } from "lucide-react"

export default function PwaPollsPage() {
  useProtectedPage()
  return (
    <PwaComingSoon
      icon={Vote}
      title="Polls"
      phase="Phase 4"
      blurb="List, payouts, edit, settings & manage — same APIs, glass UI"
    />
  )
}
