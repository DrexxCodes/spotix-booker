"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import { ThresholdSettingCard } from "./components/ThresholdSettingCard"
import { VotingLinkCard } from "./components/VotingLinkCard"

interface NominationPollSettings {
  pollId: string
  pollName: string
  nominationThreshold: number | null
  linkedVotingPollId: string | null
  linkedVotingPollName: string | null
  votingStartsAt: string | null
}

export default function NominationSettingsClient({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<NominationPollSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/polls/nominations/${pollId}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || "Failed to load this nomination poll.")
          return
        }
        setPoll(data.poll)
      } catch {
        if (!cancelled) setError("An unexpected error occurred while loading this poll.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [pollId])

  const refetch = async () => {
    const res = await fetch(`/api/polls/nominations/${pollId}`)
    const data = await res.json()
    if (res.ok) setPoll(data.poll)
  }

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/polls/nominations/${pollId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Failed to save")
    // The PATCH route only returns a confirmation message, and for a
    // voting-poll link the server resolves the pollName/start date —
    // simplest correct way to reflect that locally is to just refetch.
    await refetch()
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="w-6 h-6 text-[#6b2fa5] animate-spin" />
      </div>
    )
  }

  if (error || !poll) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-slate-600">{error || "Nomination poll not found."}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={`/polls/nominations/${pollId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to {poll.pollName}
      </Link>

      <h1 className="text-xl font-bold text-slate-900 mb-1">Nomination Settings</h1>
      <p className="text-sm text-slate-500 mb-6">{poll.pollName}</p>

      <div className="space-y-5">
        <ThresholdSettingCard
          value={poll.nominationThreshold}
          onSave={(value) => patch({ nominationThreshold: value })}
        />

        <VotingLinkCard
          linkedVotingPollId={poll.linkedVotingPollId}
          linkedVotingPollName={poll.linkedVotingPollName}
          votingStartsAt={poll.votingStartsAt}
          onLink={(votingPollId) => patch({ linkedVotingPollId: votingPollId })}
          onUnlink={() => patch({ linkedVotingPollId: null })}
        />
      </div>
    </div>
  )
}
