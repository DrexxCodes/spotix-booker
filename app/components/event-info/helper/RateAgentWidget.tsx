// components/event-info/helper/RateAgentWidget.tsx
"use client"

import { useEffect, useState } from "react"
import { Star, Loader2, MessageSquare, CheckCircle2 } from "lucide-react"

interface Props {
  agentId: string
  eventId: string
}

export default function RateAgentWidget({ agentId, eventId }: Props) {
  const [loading, setLoading] = useState(true)
  const [canRate, setCanRate] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/agents/${agentId}/rating`)
        const data = await res.json()
        if (res.ok && data.success) {
          setCanRate(data.canRate)
          if (data.myRating) {
            setRating(data.myRating.rating)
            setComment(data.myRating.comment || "")
          }
        }
      } catch {
        // non-fatal — widget just won't render its interactive state
      } finally {
        setLoading(false)
      }
    })()
  }, [agentId])

  async function submit() {
    if (rating < 1) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/agents/${agentId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, rating, comment }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to save your rating")
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError("Something went wrong. Please try again")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-[#6b2fa5]" />
      </div>
    )
  }

  if (!canRate) return null

  return (
    <div className="border-t border-slate-100 p-4 bg-slate-50/60">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare size={14} className="text-slate-400" />
        <p className="text-xs font-semibold text-slate-600">Rate this agent</p>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(n)}
            aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
          >
            <Star
              size={22}
              className={
                (hoverRating || rating) >= n
                  ? "fill-amber-400 text-amber-400 transition-colors"
                  : "text-slate-300 transition-colors"
              }
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 500))}
        placeholder="Optional — how was working with this agent?"
        rows={2}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]/20 focus:border-[#6b2fa5] mb-2"
      />

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <button
        onClick={submit}
        disabled={rating < 1 || saving}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6b2fa5] text-white text-xs font-semibold hover:bg-[#5a2589] transition-colors disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Saving...
          </>
        ) : saved ? (
          <>
            <CheckCircle2 size={14} /> Saved
          </>
        ) : (
          "Submit rating"
        )}
      </button>
    </div>
  )
}
