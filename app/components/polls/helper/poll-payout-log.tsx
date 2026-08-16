"use client"

/**
 * app/components/polls/helper/poll-payout-log.tsx
 *
 * Polls have no Vault feature, so this is simpler than the event-side
 * log: every record here is a Supabase `payouts` row (GET
 * /api/polls/payout?action=status). No cancel/reject (nothing to cancel
 * — a poll payout begins the instant it's requested) and no retry, ever
 * — a failed payout is a dead end; the only action is "Contact Spotix"
 * with the reference.
 */

import { Loader2, AlertCircle, CheckCircle2, Clock, XCircle, RefreshCw, MessageCircle, Filter, ReceiptText, Copy, Check } from "lucide-react"
import { useState, useCallback, useEffect } from "react"

type PayoutStatus = "initializing" | "processing" | "failed" | "successful"

interface PayoutRecord {
  id: string // reference
  pollId: string
  userId: string
  date: string
  amount: number
  bankName: string
  accountNumber: string
  accountName: string
  status: PayoutStatus
  failureReason?: string | null
  narration?: string | null
  createdAt: string | null
  resolvedAt?: string | null
}

interface PollPayoutLogProps {
  pollId: string
  userId: string
  /** Accepted for backward-compat with the caller — unused here since polls have no cancel/reject action (nothing pre-payout to cancel). */
  canManagePayouts?: boolean
}

const STATUS_CONFIG: Record<PayoutStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  initializing: { label: "Initializing", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: <Loader2 size={13} className="text-amber-500 animate-spin" /> },
  processing:   { label: "Processing",   bg: "bg-blue-50",  text: "text-blue-700",  border: "border-blue-200",  icon: <Loader2 size={13} className="text-blue-500 animate-spin" /> },
  failed:       { label: "Failed",       bg: "bg-red-50",   text: "text-red-700",   border: "border-red-200",   icon: <XCircle size={13} className="text-red-500" /> },
  successful:   { label: "Successful",   bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <CheckCircle2 size={13} className="text-green-500" /> },
}

const ALL_STATUSES: PayoutStatus[] = ["initializing", "processing", "failed", "successful"]

function buildSupportLink(record: PayoutRecord): string {
  const message =
    `Hi Spotix, my poll payout failed and I need help.\n\n` +
    `Reference: ${record.id}\n` +
    `Date: ${record.date}\n` +
    `Amount: ₦${Number(record.amount).toLocaleString()}\n` +
    `Reason shown: ${record.failureReason || "Not specified"}\n\n` +
    `Please advise.`
  return `https://wa.me/2348123927685?text=${encodeURIComponent(message)}`
}

export default function PollPayoutLog({ pollId, userId, canManagePayouts }: PollPayoutLogProps) {
  const [payouts, setPayouts] = useState<PayoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<PayoutStatus | "all">("all")
  const [copiedRef, setCopiedRef] = useState<string | null>(null)

  const fetchPayouts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/polls/payout?pollId=${pollId}&action=status`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch payout logs")
      setPayouts(data.payouts ?? [])
    } catch (err: any) {
      setError(err.message || "Failed to load payout logs")
    } finally {
      setLoading(false)
    }
  }, [pollId])

  useEffect(() => {
    fetchPayouts()
  }, [fetchPayouts])

  useEffect(() => {
    const hasInFlight = payouts.some((p) => p.status === "initializing" || p.status === "processing")
    if (!hasInFlight) return
    const id = setInterval(fetchPayouts, 15_000)
    return () => clearInterval(id)
  }, [payouts, fetchPayouts])

  function copyReference(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedRef(id)
      setTimeout(() => setCopiedRef(null), 1500)
    })
  }

  const filtered = activeFilter === "all" ? payouts : payouts.filter((p) => p.status === activeFilter)
  const countsByStatus = ALL_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: payouts.filter((p) => p.status === s).length }),
    {} as Record<PayoutStatus, number>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <div className="text-center space-y-3">
          <Loader2 size={30} className="animate-spin text-[#6b2fa5] mx-auto" />
          <p className="text-sm text-gray-400">Loading payout logs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
        <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-700">Failed to load payout logs</p>
          <p className="text-sm text-red-600 mt-0.5">{error}</p>
          <button onClick={fetchPayouts} className="text-xs text-red-600 underline mt-2 font-medium">Try again</button>
        </div>
      </div>
    )
  }

  if (payouts.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
        <div className="p-3 bg-gray-100 rounded-full w-fit mx-auto mb-3">
          <ReceiptText size={28} className="text-gray-400" />
        </div>
        <p className="text-gray-600 font-semibold">No payout requests yet</p>
        <p className="text-sm text-gray-400 mt-1">Submitted payout requests for this poll will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">{payouts.length} payout request{payouts.length !== 1 ? "s" : ""}</p>
        <button onClick={fetchPayouts} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#6b2fa5] transition-colors font-medium">
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFilter("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            activeFilter === "all" ? "bg-[#6b2fa5] text-white border-[#6b2fa5]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
        >
          <Filter size={11} />
          All
          <span className={`rounded-full px-1.5 py-0.5 leading-none text-[10px] font-bold ${activeFilter === "all" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
            {payouts.length}
          </span>
        </button>

        {ALL_STATUSES.map((s) => {
          const cfg = STATUS_CONFIG[s]
          const count = countsByStatus[s]
          if (count === 0) return null
          return (
            <button
              key={s}
              onClick={() => setActiveFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeFilter === s ? `${cfg.bg} ${cfg.text} ${cfg.border}` : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {cfg.icon}
              {cfg.label}
              <span className={`rounded-full px-1.5 py-0.5 leading-none text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">
            No {activeFilter !== "all" ? STATUS_CONFIG[activeFilter as PayoutStatus].label.toLowerCase() : ""} payouts found.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => {
            const cfg = STATUS_CONFIG[record.status]
            return (
              <div key={record.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 hover:shadow-sm transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-base">{record.date}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>Amount: <span className="font-semibold text-gray-800">₦{Number(record.amount).toLocaleString()}</span></span>
                      <span>Bank: <span className="font-semibold text-gray-800">{record.bankName}</span></span>
                    </div>

                    <p className="text-xs text-gray-400">
                      {record.accountName} · •••• {record.accountNumber?.slice(-4)}
                    </p>

                    {record.createdAt && (
                      <p className="text-xs text-gray-400">Submitted: {new Date(record.createdAt).toLocaleString()}</p>
                    )}

                    <button
                      onClick={() => copyReference(record.id)}
                      className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {copiedRef === record.id ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                      {record.id}
                    </button>

                    {record.status === "failed" && record.failureReason && (
                      <p className="text-xs text-red-600 mt-1">{record.failureReason}</p>
                    )}
                  </div>

                  {record.status === "failed" && (
                    <div className="flex-shrink-0">
                      <a
                        href={buildSupportLink(record)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                      >
                        <MessageCircle size={13} />
                        Contact Spotix
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
