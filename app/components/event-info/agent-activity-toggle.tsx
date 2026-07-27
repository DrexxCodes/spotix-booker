// components/event-info/agent-activity-toggle.tsx
"use client"

import { useState } from "react"
import { Users2, Loader2 } from "lucide-react"

interface Incentive {
  type: "percentage" | "flat"
  value: number
}

interface AgentActivityToggleProps {
  eventId: string
  initialValue: boolean
  initialIncentive: Incentive | null
}

export default function AgentActivityToggle({ eventId, initialValue, initialIncentive }: AgentActivityToggleProps) {
  const [enabled, setEnabled] = useState(initialValue)
  const [incentiveType, setIncentiveType] = useState<"percentage" | "flat">(initialIncentive?.type || "percentage")
  const [incentiveValue, setIncentiveValue] = useState(initialIncentive ? String(initialIncentive.value) : "")
  const [savedIncentive, setSavedIncentive] = useState<Incentive | null>(initialIncentive)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const hasValidDraft =
    incentiveValue.trim() !== "" &&
    Number.isFinite(Number(incentiveValue)) &&
    Number(incentiveValue) >= 0 &&
    (incentiveType !== "percentage" || Number(incentiveValue) <= 100)

  async function handleEnable() {
    if (!hasValidDraft) {
      setError("Set an incentive before enabling agent activity")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/event/list/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggleAgentActivity",
          agentIncentive: { type: incentiveType, value: Number(incentiveValue) },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to update agent activity")
        return
      }
      setEnabled(true)
      setSavedIncentive(data.agentIncentive)
    } catch {
      setError("Something went wrong. Please try again")
    } finally {
      setSaving(false)
    }
  }

  async function handleDisable() {
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/event/list/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleAgentActivity" }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to update agent activity")
        return
      }
      setEnabled(false)
    } catch {
      setError("Something went wrong. Please try again")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateIncentive() {
    if (!hasValidDraft) {
      setError("Enter a valid incentive")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/event/list/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setAgentIncentive",
          agentIncentive: { type: incentiveType, value: Number(incentiveValue) },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to update incentive")
        return
      }
      setSavedIncentive(data.agentIncentive)
    } catch {
      setError("Something went wrong. Please try again")
    } finally {
      setSaving(false)
    }
  }

  const incentiveChanged =
    !savedIncentive || savedIncentive.type !== incentiveType || String(savedIncentive.value) !== incentiveValue

  return (
    <div className="rounded-xl bg-white border-2 border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#6b2fa5]/8 flex items-center justify-center shrink-0">
            <Users2 size={18} className="text-[#6b2fa5]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Agent activity</p>
            <p className="text-xs text-slate-500 mt-0.5 max-w-sm">
              When on, verified Spotix agents can request to sell physical passes for this event, all earning the
              same incentive rate. Turning it off blocks all agent affiliation and sales immediately.
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={() => (enabled ? handleDisable() : handleEnable())}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6b2fa5]" />
        </label>
      </div>

      <div className="border-t border-slate-100 p-4 bg-slate-50/60 space-y-3">
        <p className="text-xs font-semibold text-slate-700">
          {enabled ? "Incentive rate (applies to every agent)" : "Set an incentive to enable agent activity"}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={incentiveType}
            onChange={(e) => setIncentiveType(e.target.value as "percentage" | "flat")}
            className="rounded-lg border border-slate-200 px-2 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]/30"
          >
            <option value="percentage">% of ticket price</option>
            <option value="flat">Flat ₦ per sale</option>
          </select>
          <input
            type="number"
            min={0}
            max={incentiveType === "percentage" ? 100 : undefined}
            placeholder={incentiveType === "percentage" ? "e.g. 10" : "e.g. 200"}
            value={incentiveValue}
            onChange={(e) => setIncentiveValue(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]/30"
          />
          {enabled && (
            <button
              onClick={handleUpdateIncentive}
              disabled={saving || !hasValidDraft || !incentiveChanged}
              className="rounded-lg bg-slate-800 text-white text-xs font-semibold px-3 py-2 hover:bg-slate-900 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
            </button>
          )}
        </div>

        {!enabled && (
          <button
            onClick={handleEnable}
            disabled={saving || !hasValidDraft}
            className="w-full sm:w-auto sm:px-10 sm:ml-auto sm:block rounded-lg bg-[#6b2fa5] text-white text-xs font-semibold py-2.5 hover:bg-[#5a2589] transition-colors disabled:opacity-50"
          >
            {saving ? "Enabling..." : "Enable agent activity"}
          </button>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}
