"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, Loader2, Link2, Link2Off, ExternalLink } from "lucide-react"

interface VotingPollOption {
  id: string
  pollName: string
  pollStartDate: string
  pollStartTime: string
}

interface VotingLinkCardProps {
  linkedVotingPollId: string | null
  linkedVotingPollName: string | null
  votingStartsAt: string | null
  onLink: (pollId: string) => Promise<void>
  onUnlink: () => Promise<void>
}

/**
 * Links this nomination poll to one of the organiser's own voting polls.
 * Once linked, the nomination page (spotix-user) shows a "Real Voting
 * Starts In" countdown built from a SNAPSHOT of the voting poll's start
 * date/time taken at link-time — re-link here if you change that poll's
 * schedule afterwards. See getVotingPollForLinking() in
 * lib/nomination-db.ts for why it's a snapshot rather than a live fetch.
 */
export function VotingLinkCard({
  linkedVotingPollId, linkedVotingPollName, votingStartsAt, onLink, onUnlink,
}: VotingLinkCardProps) {
  const [polls, setPolls] = useState<VotingPollOption[]>([])
  const [loadingPolls, setLoadingPolls] = useState(true)
  const [selected, setSelected] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/polls/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPolls(data.polls ?? [])
      })
      .catch(() => {})
      .finally(() => setLoadingPolls(false))
  }, [])

  const handleLink = async () => {
    if (!selected) return
    setError(null)
    setSaving(true)
    try {
      await onLink(selected)
    } catch {
      setError("Failed to link. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleUnlink = async () => {
    setSaving(true)
    try {
      await onUnlink()
    } catch {
      setError("Failed to unlink. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-5 h-5 text-[#6b2fa5]" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Link the Real Voting Poll</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Shows a "Real Voting Starts In" countdown on this nomination page, pointing at one
            of your own voting polls.
          </p>
        </div>
      </div>

      {linkedVotingPollId ? (
        <div className="flex items-center justify-between gap-3 bg-purple-50 rounded-xl p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{linkedVotingPollName}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {votingStartsAt
                ? `Starts ${new Date(votingStartsAt).toLocaleString()}`
                : "No start date on that poll yet"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/polls/${linkedVotingPollId}`}
              className="p-2 text-slate-400 hover:text-[#6b2fa5] rounded-lg hover:bg-white transition-colors"
              title="View voting poll"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
            <button
              onClick={handleUnlink}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
              Unlink
            </button>
          </div>
        </div>
      ) : loadingPolls ? (
        <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
      ) : polls.length === 0 ? (
        <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
          You haven't created a voting poll yet.{" "}
          <Link href="/polls/create" className="text-[#6b2fa5] font-semibold hover:underline">
            Create one
          </Link>
          , then come back here to link it.
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-black outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20"
          >
            <option value="">Select a voting poll…</option>
            {polls.map((p) => (
              <option key={p.id} value={p.id}>
                {p.pollName} {p.pollStartDate ? `— starts ${p.pollStartDate}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={handleLink}
            disabled={!selected || saving}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6b2fa5] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#5a1f8a] transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Link
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
