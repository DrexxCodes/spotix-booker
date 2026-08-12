"use client"

/**
 * app/polls/[pollId]/settings/components/TieBreakerPanel.tsx
 *
 * Lets the poll creator configure how ties get resolved once a category
 * (or the whole poll, for single polls) ends with two or more contestants
 * sharing the top vote count.
 *
 * Fields saved to voting/{pollId} via /api/polls/tiebreaker:
 *   enabledTieBreaker   boolean   — turns the feature on/off for this poll
 *   tieBreakerDuration  number    — hours each tie-breaker round stays open
 *   tieBreakerRounds    number|null — optional cap on rounds; leave blank for
 *                                     the default of a single round before
 *                                     falling back to first-past-the-post
 *
 * How it plays out once enabled (see app/polls/[pollId]/page.tsx for the
 * "tied — no winner crowned" display this feeds):
 *   1. Poll/category ends with 2+ contestants tied at the top score.
 *   2. A tie-breaker round opens for just those tied contestants, lasting
 *      tieBreakerDuration hours.
 *   3. Still tied when the round closes? If more rounds remain
 *      (tieBreakerRounds), another round opens the same way.
 *   4. Once rounds run out (or none were configured) and it's still tied,
 *      the decision becomes first-past-the-post — whoever of the tied
 *      contestants received a vote first in that final round wins.
 */

import { useCallback, useEffect, useState } from "react"
import { Scale, Loader2, AlertCircle, CheckCircle, Info } from "lucide-react"
import { authFetch } from "@/lib/auth-client"

interface TieBreakerPanelProps {
  pollId: string
  /** True for the poll creator. Team members see the current
   *  configuration read-only — POST /api/polls/tiebreaker stays
   *  creator-only, same as the event link/unlink controls. */
  isOwner?: boolean
}

export default function TieBreakerPanel({ pollId, isOwner = true }: TieBreakerPanelProps) {
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState("")
  const [success, setSuccess]   = useState("")

  const [enabled,  setEnabled]  = useState(false)
  const [duration, setDuration] = useState("")   // hours, kept as string for the input
  const [rounds,   setRounds]   = useState("")   // optional, kept as string for the input

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res  = await authFetch(`/api/polls/tiebreaker?pollId=${pollId}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to load tie-breaker settings."); return }
      setEnabled(Boolean(data.enabledTieBreaker))
      setDuration(data.tieBreakerDuration != null ? String(data.tieBreakerDuration) : "")
      setRounds(data.tieBreakerRounds != null ? String(data.tieBreakerRounds) : "")
    } catch {
      setError("Network error loading tie-breaker settings.")
    } finally {
      setLoading(false)
    }
  }, [pollId])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    setError("")
    setSuccess("")

    if (enabled && (!duration.trim() || Number(duration) <= 0)) {
      setError("Enter how many hours each tie-breaker round should last.")
      setSaving(false)
      return
    }

    try {
      const res  = await authFetch("/api/polls/tiebreaker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollId,
          enabledTieBreaker:  enabled,
          tieBreakerDuration: enabled ? Number(duration) : null,
          tieBreakerRounds:   enabled && rounds.trim() ? Number(rounds) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to save tie-breaker settings."); return }
      setSuccess("Tie-breaker settings saved.")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-[#6b2fa5]" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <Scale className="w-4 h-4 text-[#6b2fa5]" /> Tie-Breaker
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => { if (isOwner) setEnabled((v) => !v) }}
          disabled={!isOwner}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-[#6b2fa5]" : "bg-slate-200"
          } ${!isOwner ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-5">
        If a category (or the whole poll, for single polls) ends with two or more contestants tied for the top
        spot, a tie-breaker round opens automatically for just those contestants instead of crowning a winner
        by chance.
      </p>

      {enabled && (
        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Round duration (hours) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={336}
              value={duration}
              onChange={(e) => { setDuration(e.target.value); setError(""); setSuccess("") }}
              placeholder="e.g. 24"
              disabled={!isOwner}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20 disabled:bg-slate-50 disabled:text-slate-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">How long tied contestants get to compete in each tie-breaker round.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Number of rounds <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={rounds}
              onChange={(e) => { setRounds(e.target.value); setError(""); setSuccess("") }}
              placeholder="Leave blank for 1 round, then first-past-the-post"
              disabled={!isOwner}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20 disabled:bg-slate-50 disabled:text-slate-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              If contestants are still tied after a round, another round opens — up to this many. Leave blank to
              go straight to first-past-the-post after one round.
            </p>
          </div>

          <div className="flex items-start gap-2.5 bg-purple-50 border border-purple-200 rounded-xl p-3.5">
            <Info className="w-4 h-4 text-[#6b2fa5] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-purple-700 leading-relaxed">
              Once every configured round is exhausted and contestants are still tied, the tie is settled
              first-past-the-post — whichever tied contestant receives a vote first in that final round wins.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-4">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl p-3.5 mb-4">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-700">{success}</p>
        </div>
      )}

      {isOwner && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#6b2fa5] hover:bg-[#5a1f8a] text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
          Save Tie-Breaker Settings
        </button>
      )}
      {!isOwner && (
        <p className="text-xs text-slate-400 text-center">Only the poll creator can change tie-breaker settings.</p>
      )}
    </div>
  )
}
