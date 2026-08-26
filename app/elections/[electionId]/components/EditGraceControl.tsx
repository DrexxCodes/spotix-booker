"use client"

/**
 * app/elections/[electionId]/components/EditGraceControl.tsx
 *
 * Lets the organiser view and adjust how many days after submitting a
 * candidate can still edit their own details (name/phone/photo/answers
 * — never their office or election). 0 = no edit window.
 *
 * Adjusting this retroactively changes the deadline for every candidate
 * already registered — the deadline is always computed as
 * candidate.created_at + edit_grace_days (see spotix-vote's
 * lib/election/edit.ts), not frozen per-candidate at submission time.
 */

import { useState } from "react"

export function EditGraceControl({ electionId, initialDays }: { electionId: string; initialDays: number }) {
  const [days, setDays] = useState(initialDays)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(initialDays))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const value = Number(draft)
    if (!Number.isInteger(value) || value < 0) {
      setError("Enter a whole number of days, 0 or more")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/elections/${electionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editGraceDays: value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to update")
      setDays(value)
      setEditing(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs text-gray-500 underline decoration-dotted">
        Candidate edit window: {days === 0 ? "no edits allowed" : `${days} day${days === 1 ? "" : "s"} after submitting`}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#6b2fa5]"
      />
      <span className="text-xs text-gray-500">days to edit after submitting</span>
      <button onClick={save} disabled={saving} className="text-xs font-medium text-[#6b2fa5]">
        {saving ? "Saving…" : "Save"}
      </button>
      <button onClick={() => { setEditing(false); setDraft(String(days)) }} className="text-xs text-gray-400">
        Cancel
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
