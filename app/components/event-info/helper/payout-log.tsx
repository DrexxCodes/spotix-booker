"use client"

import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  MessageCircle,
  Filter,
  ReceiptText,
  ScrollText,
  Ban,
  Lock,
} from "lucide-react"
import { useState, useCallback, useEffect } from "react"
import PayoutTimelineModal from "./payout-timeline-modal"

type PayoutStatus = "pending" | "processing" | "failed" | "successful" | "vault_pending" | "cancelled" | "rejected"

interface LogEntry {
  type: string
  at: string
  byUid?: string
  byName?: string
  byEmail?: string
  message: string
  meta?: { maskedAccountNumber?: string; bankName?: string }
}

interface PayoutRecord {
  id: string
  eventId: string
  userId: string
  date: string
  amount: number
  bankName: string
  bankCode: string
  accountNumber: string
  accountName: string
  status: PayoutStatus
  createdAt: string | null
  updatedAt: string | null
  pendingAt: string | null
  processingAt: string | null
  initiatedByName?: string
  initiatedByEmail?: string
  cancelledByName?: string
  logs?: LogEntry[]
}

interface PayoutLogProps {
  eventId: string
  userId: string
  /** Can this viewer cancel/reject any active payout on the event (not just their own)? */
  canManage?: boolean
  /** Fired after a payout is successfully cancelled or rejected, so a parent
   *  can refresh anything derived from payout status (e.g. the Vault
   *  sign-off panel, which must drop a rejected/cancelled payout instantly). */
  onCancelled?: () => void
}

const STATUS_CONFIG: Record<
  PayoutStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: <Clock size={13} className="text-amber-500" />,
  },
  processing: {
    label: "Processing",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: <Loader2 size={13} className="text-blue-500 animate-spin" />,
  },
  failed: {
    label: "Failed",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    icon: <XCircle size={13} className="text-red-500" />,
  },
  successful: {
    label: "Successful",
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    icon: <CheckCircle2 size={13} className="text-green-500" />,
  },
  vault_pending: {
    label: "Awaiting Vault Sign-off",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    icon: <Lock size={13} className="text-purple-500" />,
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-gray-100",
    text: "text-gray-600",
    border: "border-gray-300",
    icon: <Ban size={13} className="text-gray-500" />,
  },
  rejected: {
    label: "Rejected",
    bg: "bg-gray-100",
    text: "text-gray-600",
    border: "border-gray-300",
    icon: <XCircle size={13} className="text-gray-500" />,
  },
}

const ALL_STATUSES: PayoutStatus[] = ["pending", "processing", "vault_pending", "failed", "successful", "cancelled", "rejected"]
const STALE_HOURS = 2

function hoursElapsed(iso: string | null): number {
  if (!iso) return 0
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60)
}

function isPendingStale(record: PayoutRecord): boolean {
  if (record.status !== "pending") return false
  const ref = record.pendingAt ?? record.createdAt
  return hoursElapsed(ref) >= STALE_HOURS
}

function isProcessingStale(record: PayoutRecord): boolean {
  return record.status === "processing" && hoursElapsed(record.processingAt) >= STALE_HOURS
}

function buildWhatsAppLink(record: PayoutRecord, kind: "pending" | "processing"): string {
  const submittedStr = record.createdAt
    ? new Date(record.createdAt).toLocaleString()
    : "Unknown"

  const statusTimestampLabel = kind === "pending" ? "Pending since" : "Processing since"
  const statusTimestamp =
    kind === "pending"
      ? record.pendingAt
        ? new Date(record.pendingAt).toLocaleString()
        : "Unknown"
      : record.processingAt
        ? new Date(record.processingAt).toLocaleString()
        : "Unknown"

  const intro =
    kind === "pending"
      ? "My payout has been pending for more than 2 hours."
      : "My payout has been processing for more than 2 hours."

  const message =
    `${intro} Here are my payout details:\n\n` +
    `Event ID: ${record.eventId}\n` +
    `Transaction Date: ${record.date}\n` +
    `Amount: ₦${Number(record.amount).toLocaleString()}\n` +
    `Bank: ${record.bankName}\n` +
    `Account: ${record.accountName} (•••• ${record.accountNumber.slice(-4)})\n` +
    `Payout ID: ${record.id}\n` +
    `Submitted: ${submittedStr}\n` +
    `${statusTimestampLabel}: ${statusTimestamp}\n\n` +
    `Thank you`

  return `https://wa.me/2348123927685?text=${encodeURIComponent(message)}`
}

export default function PayoutLog({ eventId, userId, canManage = false, onCancelled }: PayoutLogProps) {
  const [payouts, setPayouts] = useState<PayoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<PayoutStatus | "all">("all")
  const [rerunning, setRerunning] = useState<Set<string>>(new Set())
  const [rerunErrors, setRerunErrors] = useState<Record<string, string>>({})
  const [cancelling, setCancelling] = useState<Set<string>>(new Set())
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({})
  const [confirmCancel, setConfirmCancel] = useState<PayoutRecord | null>(null)
  const [timelineRecord, setTimelineRecord] = useState<PayoutRecord | null>(null)

  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const fetchPayouts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/payout?eventId=${eventId}&action=status`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch payout logs")
      setPayouts(data.payouts ?? [])
    } catch (err: any) {
      setError(err.message || "Failed to load payout logs")
    } finally {
      setLoading(false)
    }
  }, [eventId])

  // Initial fetch
  useEffect(() => {
    fetchPayouts()
  }, [fetchPayouts])

  // Poll every 30s while any payout is pending, processing, or awaiting Vault sign-off
  useEffect(() => {
    const hasInFlight = payouts.some(
      (p) => p.status === "pending" || p.status === "processing" || p.status === "vault_pending"
    )
    if (!hasInFlight) return

    const id = setInterval(fetchPayouts, 30_000)
    return () => clearInterval(id)
  }, [payouts, fetchPayouts])

  async function handleRerun(record: PayoutRecord) {
    setRerunning((prev) => new Set([...prev, record.id]))
    setRerunErrors((prev) => {
      const next = { ...prev }
      delete next[record.id]
      return next
    })

    try {
      const res = await fetch("/api/payout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutId: record.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to re-run payout")
      setPayouts((prev) =>
        prev.map((p) =>
          p.id === record.id
            ? { ...p, status: "pending", pendingAt: new Date().toISOString() }
            : p
        )
      )
    } catch (err: any) {
      setRerunErrors((prev) => ({
        ...prev,
        [record.id]: err.message || "Re-run failed",
      }))
    } finally {
      setRerunning((prev) => {
        const next = new Set(prev)
        next.delete(record.id)
        return next
      })
    }
  }

  async function handleCancel(record: PayoutRecord) {
    setCancelling((prev) => new Set([...prev, record.id]))
    setCancelErrors((prev) => {
      const next = { ...prev }
      delete next[record.id]
      return next
    })

    try {
      const res = await fetch("/api/payout", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutId: record.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to cancel/reject payout")
      setConfirmCancel(null)
      await fetchPayouts()
      onCancelled?.()
    } catch (err: any) {
      setCancelErrors((prev) => ({
        ...prev,
        [record.id]: err.message || "Action failed",
      }))
    } finally {
      setCancelling((prev) => {
        const next = new Set(prev)
        next.delete(record.id)
        return next
      })
    }
  }

  // Same set of statuses is actionable whether the outcome is a self-cancel
  // or a reject by someone else — the server decides which based on who's
  // calling (see DELETE /api/payout).
  const ACTIONABLE: PayoutStatus[] = ["pending", "processing", "vault_pending"]

  const filtered =
    activeFilter === "all" ? payouts : payouts.filter((p) => p.status === activeFilter)

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
          <button
            onClick={fetchPayouts}
            className="text-xs text-red-600 underline mt-2 font-medium"
          >
            Try again
          </button>
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
        <p className="text-sm text-gray-400 mt-1">
          Submitted payout requests for this event will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          {payouts.length} payout request{payouts.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={fetchPayouts}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#6b2fa5] transition-colors font-medium"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFilter("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            activeFilter === "all"
              ? "bg-[#6b2fa5] text-white border-[#6b2fa5]"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
        >
          <Filter size={11} />
          All
          <span
            className={`rounded-full px-1.5 py-0.5 leading-none text-[10px] font-bold ${
              activeFilter === "all" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
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
                activeFilter === s
                  ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {cfg.icon}
              {cfg.label}
              <span
                className={`rounded-full px-1.5 py-0.5 leading-none text-[10px] font-bold ${cfg.bg} ${cfg.text}`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">
            No{" "}
            {activeFilter !== "all"
              ? STATUS_CONFIG[activeFilter as PayoutStatus].label.toLowerCase()
              : ""}{" "}
            payouts found.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => {
            const cfg = STATUS_CONFIG[record.status]
            const pendingStale = isPendingStale(record)
            const processingStale = isProcessingStale(record)
            const isRerunning = rerunning.has(record.id)
            const rerunError = rerunErrors[record.id]
            const isCancelling = cancelling.has(record.id)
            const cancelError = cancelErrors[record.id]
            const isInitiator = record.userId === userId
            const canAct = canManage && ACTIONABLE.includes(record.status)
            const canCancel = canAct && isInitiator
            const canReject = canAct && !isInitiator

            return (
              <div
                key={record.id}
                className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-base">{record.date}</span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </span>
                      {(pendingStale || processingStale) && (
                        <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-semibold">
                          <Clock size={11} />
                          Overdue
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span>
                        Amount:{" "}
                        <span className="font-semibold text-gray-800">
                          ₦{Number(record.amount).toLocaleString()}
                        </span>
                      </span>
                      <span>
                        Bank:{" "}
                        <span className="font-semibold text-gray-800">{record.bankName}</span>
                      </span>
                    </div>

                    <p className="text-xs text-gray-400">
                      {record.accountName} · •••• {record.accountNumber.slice(-4)}
                    </p>

                    {record.initiatedByName && (
                      <p className="text-xs text-gray-400">
                        Requested by: <span className="text-gray-600 font-medium">{record.initiatedByName}</span>
                      </p>
                    )}

                    {record.createdAt && (
                      <p className="text-xs text-gray-400">
                        Submitted: {new Date(record.createdAt).toLocaleString()}
                      </p>
                    )}
                    {record.pendingAt && (
                      <p className="text-xs text-gray-400">
                        Pending since: {new Date(record.pendingAt).toLocaleString()}
                      </p>
                    )}
                    {record.processingAt && (
                      <p className="text-xs text-gray-400">
                        Processing since: {new Date(record.processingAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 items-end flex-shrink-0">
                    <button
                      onClick={() => setTimelineRecord(record)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#6b2fa5] hover:text-[#5a2589] transition-colors"
                    >
                      <ScrollText size={12} />
                      Logs
                    </button>

                    {canCancel && (
                      <button
                        onClick={() => setConfirmCancel(record)}
                        disabled={isCancelling}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
                      >
                        {isCancelling ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            Stopping...
                          </>
                        ) : (
                          <>
                            <Ban size={13} />
                            Stop Payout
                          </>
                        )}
                      </button>
                    )}

                    {canReject && (
                      <button
                        onClick={() => setConfirmCancel(record)}
                        disabled={isCancelling}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {isCancelling ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            Rejecting...
                          </>
                        ) : (
                          <>
                            <XCircle size={13} />
                            Reject
                          </>
                        )}
                      </button>
                    )}

                    {record.status === "failed" && (
                      <button
                        onClick={() => handleRerun(record)}
                        disabled={isRerunning}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {isRerunning ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            Re-running...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={13} />
                            Re-run
                          </>
                        )}
                      </button>
                    )}

                    {pendingStale && (
                      <a
                        href={buildWhatsAppLink(record, "pending")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                      >
                        <MessageCircle size={13} />
                        Report — Pending too long
                      </a>
                    )}

                    {processingStale && (
                      <a
                        href={buildWhatsAppLink(record, "processing")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        <MessageCircle size={13} />
                        Report — Processing too long
                      </a>
                    )}
                  </div>
                </div>

                {rerunError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-2 items-start">
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{rerunError}</p>
                  </div>
                )}

                {cancelError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-2 items-start">
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{cancelError}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {timelineRecord && (
        <PayoutTimelineModal record={timelineRecord} onClose={() => setTimelineRecord(null)} />
      )}

      {confirmCancel && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmCancel(null) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                {confirmCancel.userId === userId ? (
                  <Ban size={22} className="text-red-600" />
                ) : (
                  <XCircle size={22} className="text-red-600" />
                )}
              </div>
            </div>
            {confirmCancel.userId === userId ? (
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-gray-900">Stop this payout?</h3>
                <p className="text-sm text-gray-600">
                  The payout for <span className="font-semibold">{confirmCancel.date}</span> (₦
                  {Number(confirmCancel.amount).toLocaleString()}) will be marked as cancelled. This
                  stays visible in the logs and can't be undone. If it's already processing, funds
                  already sent won't be reversed by this action.
                </p>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-gray-900">Reject this payout?</h3>
                <p className="text-sm text-gray-600">
                  The payout for <span className="font-semibold">{confirmCancel.date}</span> (₦
                  {Number(confirmCancel.amount).toLocaleString()}), requested by{" "}
                  <span className="font-semibold">{confirmCancel.initiatedByName ?? "another team member"}</span>,
                  will be permanently rejected. It can no longer proceed — any remaining Vault
                  sign-offs will be blocked — and this can't be undone.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCancel(null)}
                disabled={cancelling.has(confirmCancel.id)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                onClick={() => handleCancel(confirmCancel)}
                disabled={cancelling.has(confirmCancel.id)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {cancelling.has(confirmCancel.id) ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : confirmCancel.userId === userId ? (
                  <Ban size={14} />
                ) : (
                  <XCircle size={14} />
                )}
                {confirmCancel.userId === userId ? "Stop Payout" : "Reject Payout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
