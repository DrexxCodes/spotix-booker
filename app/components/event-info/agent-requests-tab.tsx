// components/event-info/agent-requests-tab.tsx
"use client"

import { useEffect, useState } from "react"
import { UserCheck, UserX, Clock, ShieldCheck, ChevronDown, ChevronUp, Ticket, TrendingUp, Loader2, Star, AlertTriangle, Trash2, X } from "lucide-react"
import RateAgentWidget from "./helper/RateAgentWidget"

interface TicketPrice {
  policy: string
  price: number
  quantity?: number
}

interface AgentRequest {
  agentId: string
  agentUserId: string
  agentName: string
  agentProfile: string | null
  status: "pending" | "accepted" | "rejected" | "revoked"
  passConfig: { mode: "unrestricted" | "pregenerated"; byType?: Record<string, number> } | null
  requestedAt: string | null
  revokedAt?: string | null
  revokedReason?: string | null
}

interface AgentRequestsTabProps {
  eventId: string
  isFree: boolean
  ticketPrices: TicketPrice[]
  agentIncentive: { type: "percentage" | "flat"; value: number } | null
}

interface PoolStat {
  available: number
  reserved: number
  sold: number
}

export default function AgentRequestsTab({ eventId, isFree, ticketPrices, agentIncentive }: AgentRequestsTabProps) {
  const [requests, setRequests] = useState<AgentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null)

  async function fetchRequests() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/event/list/${eventId}/agent-requests`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load agent requests")
        return
      }
      setRequests(data.requests || [])
    } catch {
      setError("Something went wrong. Please try again")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  async function respond(agentId: string, action: "accept" | "reject") {
    setActingOn(agentId)
    try {
      const res = await fetch(`/api/event/list/${eventId}/agent-requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, action }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to update request")
        return
      }
      setRequests((prev) => prev.map((r) => (r.agentId === agentId ? { ...r, status: data.status } : r)))
      if (action === "accept") setExpandedAgentId(agentId)
    } catch {
      setError("Something went wrong. Please try again")
    } finally {
      setActingOn(null)
    }
  }

  async function revokeAgent(agentId: string, reason: string) {
    setActingOn(agentId)
    try {
      const res = await fetch(`/api/event/list/${eventId}/agent-requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, action: "revoke", reason }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to remove this agent")
        return false
      }
      setRequests((prev) =>
        prev.map((r) => (r.agentId === agentId ? { ...r, status: "revoked", revokedReason: reason } : r))
      )
      return true
    } catch {
      setError("Something went wrong. Please try again")
      return false
    } finally {
      setActingOn(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-[#6b2fa5]" size={24} />
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#6b2fa5]/8 flex items-center justify-center">
          <ShieldCheck size={26} className="text-[#6b2fa5]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-1">No agent requests yet</h3>
          <p className="text-sm text-slate-500 max-w-xs">
            When a verified agent requests to sell physical passes for this event, they'll show up here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
      )}

      {requests.map((r) => (
        <div key={r.agentId} className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-slate-100 overflow-hidden shrink-0">
                {r.agentProfile && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.agentProfile} alt={r.agentName} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{r.agentName || "Unnamed agent"}</p>
                <p className="text-xs text-slate-400 font-mono">{r.agentId}</p>
              </div>
            </div>

            {r.status === "pending" && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setExpandedAgentId(expandedAgentId === r.agentId ? null : r.agentId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  <Star size={14} /> Ratings
                  {expandedAgentId === r.agentId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button
                  onClick={() => respond(r.agentId, "reject")}
                  disabled={actingOn === r.agentId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <UserX size={14} /> Reject
                </button>
                <button
                  onClick={() => respond(r.agentId, "accept")}
                  disabled={actingOn === r.agentId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6b2fa5] text-white text-xs font-semibold hover:bg-[#5a2589] transition-colors disabled:opacity-50"
                >
                  <UserCheck size={14} /> Accept
                </button>
              </div>
            )}

            {r.status === "rejected" && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg shrink-0">
                <UserX size={14} /> Rejected
              </span>
            )}

            {r.status === "revoked" && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg shrink-0">
                <Trash2 size={14} /> Removed
              </span>
            )}

            {r.status === "accepted" && (
              <button
                onClick={() => setExpandedAgentId(expandedAgentId === r.agentId ? null : r.agentId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors shrink-0"
              >
                <ShieldCheck size={14} /> Accepted
                {expandedAgentId === r.agentId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>

          {r.status === "revoked" && r.revokedReason && (
            <div className="px-4 pb-4 -mt-1">
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">Removed:</span> {r.revokedReason}
                </p>
              </div>
            </div>
          )}

          {r.status === "pending" && expandedAgentId === r.agentId && <AgentRatingSummary agentId={r.agentId} />}

          {r.status === "accepted" && expandedAgentId === r.agentId && (
            <>
              <PassConfigPanel
                eventId={eventId}
                agentId={r.agentId}
                isFree={isFree}
                ticketPrices={ticketPrices}
                agentIncentive={agentIncentive}
              />
              <AgentRatingSummary agentId={r.agentId} />
              <RateAgentWidget agentId={r.agentId} eventId={eventId} />
              <RevokeAgentPanel agentId={r.agentId} onRevoke={(reason) => revokeAgent(r.agentId, reason)} />
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Ticket issuance + stats panel (instruction 8) ─────────────────────────────
function PassConfigPanel({
  eventId,
  agentId,
  isFree,
  ticketPrices,
  agentIncentive,
}: {
  eventId: string
  agentId: string
  isFree: boolean
  ticketPrices: TicketPrice[]
  agentIncentive: { type: "percentage" | "flat"; value: number } | null
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [passConfig, setPassConfig] = useState<{ mode: "unrestricted" | "pregenerated"; byType?: Record<string, number> } | null>(null)
  const [poolByType, setPoolByType] = useState<Record<string, PoolStat>>({})
  const [stats, setStats] = useState({ totalSold: 0, totalRevenue: 0, pendingCount: 0 })

  const [mode, setMode] = useState<"unrestricted" | "pregenerated">("unrestricted")
  const [counts, setCounts] = useState<Record<string, string>>({})

  const types = isFree ? [{ policy: "General", price: 0 }] : ticketPrices

  async function fetchPass() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/event/list/${eventId}/agent-requests/${agentId}/pass`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load pass details")
        return
      }
      setPassConfig(data.passConfig)
      setPoolByType(data.poolByType || {})
      setStats(data.stats || { totalSold: 0, totalRevenue: 0, pendingCount: 0 })
      if (data.passConfig?.mode) setMode(data.passConfig.mode)
    } catch {
      setError("Something went wrong. Please try again")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPass()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, agentId])

  async function handleConfigure() {
    setSaving(true)
    setError("")
    try {
      const body: Record<string, any> = { mode }
      if (mode === "pregenerated") {
        const allocations = types
          .map((t) => ({ ticketType: t.policy, count: Number(counts[t.policy] || 0) }))
          .filter((a) => a.count > 0)
        if (allocations.length === 0) {
          setError("Enter at least one ticket count to issue")
          setSaving(false)
          return
        }
        body.allocations = allocations
      }

      const res = await fetch(`/api/event/list/${eventId}/agent-requests/${agentId}/pass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to configure pass")
        return
      }
      setCounts({})
      await fetchPass()
    } catch {
      setError("Something went wrong. Please try again")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="border-t border-slate-100 p-6 flex justify-center">
        <Loader2 className="animate-spin text-[#6b2fa5]" size={20} />
      </div>
    )
  }

  return (
    <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <p className="text-xs text-slate-500">Sold</p>
          <p className="text-lg font-bold text-slate-900">{stats.totalSold}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <p className="text-xs text-slate-500">Revenue</p>
          <p className="text-lg font-bold text-slate-900">₦{stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <p className="text-xs text-slate-500">Pending</p>
          <p className="text-lg font-bold text-slate-900">{stats.pendingCount}</p>
        </div>
      </div>

      {/* Current config */}
      {passConfig?.mode === "pregenerated" && Object.keys(poolByType).length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
            <Ticket size={13} /> Current allocation
          </p>
          <div className="space-y-1">
            {Object.entries(poolByType).map(([type, s]) => (
              <div key={type} className="flex justify-between text-xs text-slate-600">
                <span>{type}</span>
                <span>
                  {s.available} available · {s.reserved} reserved · {s.sold} sold
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {passConfig?.mode === "unrestricted" && (
        <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs text-slate-600 flex items-center gap-1.5">
          <TrendingUp size={13} /> This agent can sell without a fixed allocation.
        </div>
      )}

      {/* Configure form */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-600">
          {passConfig ? "Update allocation" : "Set up how this agent sells"}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("unrestricted")}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-colors ${
              mode === "unrestricted"
                ? "bg-[#6b2fa5] text-white border-[#6b2fa5]"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Unrestricted
          </button>
          <button
            onClick={() => setMode("pregenerated")}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-colors ${
              mode === "pregenerated"
                ? "bg-[#6b2fa5] text-white border-[#6b2fa5]"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Pre-generate tickets
          </button>
        </div>

        {mode === "pregenerated" && (
          <div className="space-y-2">
            {types.map((t) => (
              <div key={t.policy} className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-600">{t.policy}</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={counts[t.policy] || ""}
                  onChange={(e) => setCounts((prev) => ({ ...prev, [t.policy]: e.target.value }))}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]/30"
                />
              </div>
            ))}
            <p className="text-[11px] text-slate-400">
              Adds to any existing allocation — it won't reset tickets already issued.
            </p>
          </div>
        )}

        <button
          onClick={handleConfigure}
          disabled={saving}
          className="w-full sm:w-auto sm:px-10 sm:ml-auto sm:block rounded-lg bg-[#6b2fa5] text-white text-xs font-semibold py-2.5 hover:bg-[#5a2589] transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : passConfig ? "Update" : "Confirm setup"}
        </button>
      </div>

      {/* Incentive is event-wide now (set once for all agents from the
          Teams tab's Agent Activity card), so this is read-only display
          rather than a per-agent editor. */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-600">Incentive</p>
        <p className="text-[11px] text-slate-400">
          What this agent earns per sale — the same rate every agent on this event gets. Deducted from your
          revenue for that sale.
        </p>
        {agentIncentive ? (
          <div className="text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2 w-fit">
            {agentIncentive.type === "percentage"
              ? `${agentIncentive.value}%`
              : `₦${agentIncentive.value.toLocaleString()} flat`}{" "}
            per sale
          </div>
        ) : (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            No incentive set yet — set one from the Teams tab.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Ratings + revocation history — shown before accepting, and while
// managing an already-accepted agent ────────────────────────────────────────
interface ReviewEntry {
  bookerName: string
  eventName: string
  rating: number
  comment: string
  updatedAt: string | null
}
interface RevocationEntry {
  eventName: string
  reason: string
  revokedByName: string
  revokedAt: string | null
}

function AgentRatingSummary({ agentId }: { agentId: string }) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ average: 0, total: 0 })
  const [reviews, setReviews] = useState<ReviewEntry[]>([])
  const [revocations, setRevocations] = useState<RevocationEntry[]>([])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/agents/${agentId}/reviews`)
        const data = await res.json()
        if (res.ok && data.success) {
          setSummary(data.summary || { average: 0, total: 0 })
          setReviews(data.reviews || [])
          setRevocations(data.revocations || [])
        }
      } catch {
        // non-fatal — panel just shows nothing
      } finally {
        setLoading(false)
      }
    })()
  }, [agentId])

  if (loading) {
    return (
      <div className="flex justify-center py-6 border-t border-slate-100">
        <Loader2 size={16} className="animate-spin text-[#6b2fa5]" />
      </div>
    )
  }

  return (
    <div className="border-t border-slate-100 p-4 bg-slate-50/60 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={14}
              className={n <= Math.round(summary.average) ? "fill-amber-400 text-amber-400" : "text-slate-300"}
            />
          ))}
        </div>
        <span className="text-sm font-bold text-slate-900">{summary.average.toFixed(1)}</span>
        <span className="text-xs text-slate-500">
          ({summary.total} rating{summary.total === 1 ? "" : "s"})
        </span>
      </div>

      {revocations.length > 0 && (
        <div className="space-y-1.5">
          {revocations.map((rv, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700"
            >
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <p>
                Removed from <span className="font-semibold">{rv.eventName || "another event"}</span> by{" "}
                {rv.revokedByName}: {rv.reason}
              </p>
            </div>
          ))}
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-xs text-slate-400">No ratings yet from other bookers.</p>
      ) : (
        <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
          {reviews.map((r, i) => (
            <div key={i} className="text-xs border-l-2 border-[#6b2fa5]/20 pl-2.5">
              <div className="flex items-center gap-1 mb-0.5">
                {Array.from({ length: r.rating }).map((_, s) => (
                  <Star key={s} size={10} className="fill-amber-400 text-amber-400" />
                ))}
                <span className="font-medium text-slate-700 ml-1">{r.bookerName}</span>
                {r.eventName && <span className="text-slate-400">· {r.eventName}</span>}
              </div>
              {r.comment && <p className="text-slate-500 leading-snug">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Revoke (remove) an accepted agent — mandatory reason ──────────────────────
function RevokeAgentPanel({ agentId, onRevoke }: { agentId: string; onRevoke: (reason: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("A reason is required to remove this agent")
      return
    }
    setSubmitting(true)
    setError("")
    const success = await onRevoke(reason.trim())
    setSubmitting(false)
    if (!success) setError("Failed to remove this agent — please try again")
  }

  if (!open) {
    return (
      <div className="border-t border-slate-100 p-4">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
        >
          <Trash2 size={14} /> Remove this agent from the event
        </button>
      </div>
    )
  }

  return (
    <div className="border-t border-slate-100 p-4 bg-red-50/50 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
          <AlertTriangle size={14} /> Remove agent — this deletes their unsold passes
        </p>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>
      <p className="text-xs text-slate-500">
        A reason is required. Other bookers considering this agent — and the agent themselves — will see it.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 500))}
        placeholder="Why are you removing this agent?"
        rows={2}
        className="w-full rounded-lg border border-red-200 px-3 py-2 text-xs text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={submitting || !reason.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Removing...
          </>
        ) : (
          <>
            <Trash2 size={14} /> Confirm removal
          </>
        )}
      </button>
    </div>
  )
}
