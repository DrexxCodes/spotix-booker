"use client"

import { useState } from "react"
import { Trophy, Loader2 } from "lucide-react"
import { MIN_NOMINATION_THRESHOLD, MAX_NOMINATION_THRESHOLD } from "@/lib/nomination-config"

interface ThresholdSettingCardProps {
  value: number | null
  onSave: (value: number | null) => Promise<void>
}

/**
 * Nomination Threshold — the max number of nominations one candidate can
 * receive before they "qualify" for the real vote. Once a nominee's count
 * hits this number, further nominations for them are rejected (both from
 * the category list and from a direct shared candidate link) and the UI
 * shows "Max Nomination" instead. See submit_nomination() in
 * /supabase/schema.sql for the enforcement, and NomineeCard.tsx /
 * SharedNomineeSheet.tsx in spotix-user for the display side.
 *
 * Stored on the poll row itself (nomination_polls.nomination_threshold),
 * which spotix-user already caches for 60s alongside the rest of the
 * poll's metadata — so checking the threshold never costs an extra
 * database hit beyond what was already happening.
 */
export function ThresholdSettingCard({ value, onSave }: ThresholdSettingCardProps) {
  const [enabled, setEnabled] = useState(value != null)
  const [draft, setDraft] = useState(value?.toString() ?? "50")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = enabled !== (value != null) || (enabled && Number(draft) !== value)

  const handleSave = async () => {
    setError(null)
    let next: number | null = null
    if (enabled) {
      const n = Number(draft)
      if (!Number.isInteger(n) || n < MIN_NOMINATION_THRESHOLD || n > MAX_NOMINATION_THRESHOLD) {
        setError(`Enter a whole number between ${MIN_NOMINATION_THRESHOLD} and ${MAX_NOMINATION_THRESHOLD}`)
        return
      }
      next = n
    }

    setSaving(true)
    try {
      await onSave(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError("Failed to save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          <Trophy className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Nomination Threshold</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Once a candidate hits this many nominations, they've qualified for the real vote —
            further nominations for them are blocked and visitors see "Max Nomination" instead,
            even from a direct shared link to that candidate.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4 accent-[#6b2fa5]"
        />
        <span className="text-sm font-medium text-slate-700">Cap nominations per candidate</span>
      </label>

      {enabled && (
        <div className="flex items-center gap-2 mb-2">
          <input
            type="number"
            min={MIN_NOMINATION_THRESHOLD}
            max={MAX_NOMINATION_THRESHOLD}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-32 px-3 py-2 rounded-xl border border-slate-300 text-sm text-black outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20"
          />
          <span className="text-sm text-slate-500">nominations</span>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6b2fa5] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#5a1f8a] transition-colors"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save
        </button>
        {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
      </div>
    </div>
  )
}
