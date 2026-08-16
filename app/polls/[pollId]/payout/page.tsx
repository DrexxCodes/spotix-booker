"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import {
  Loader,
  ArrowLeft,
  AlertCircle,
  Wallet,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  X,
  ChevronRight,
  Loader2,
  Ban,
  CalendarX,
  ReceiptText,
  Shield,
} from "lucide-react"
import PollPayoutConfirmation from "@/components/polls/helper/poll-payout-confirmation"
import PollPayoutLog from "@/components/polls/helper/poll-payout-log"
import PayoutStateDialog from "@/components/payout/PayoutStateDialog"
import type { PayoutLiveState } from "@/components/payout/use-payout-stream"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Poll {
  id: string
  pollName: string
  pollAmount: number
  pollCount: number
  pollPrice: number
  totalPaidOut: number
  flagged: boolean
  suspended: boolean
  updatedAt: string | null
  /** "owner" (the creator) or "member" (an added poll team mate) — from
   *  /api/polls/list. Team members can view everything on this page but
   *  can't initiate a payout, so this gates the action buttons below. */
  role?: "owner" | "member"
}

interface DailyVoteTransaction {
  date: string
  pollName?: string
  voteCount: number
  voteSales: number
  lastVoteTime?: string
  createdAt?: string
  lastUpdated: string
}

interface PayoutMethod {
  id: string
  accountNumber: string
  bankName: string
  bankCode: string
  accountName: string
  primary: boolean
  createdAt: string
}

type PayoutErrorKind = "restrictedDay" | "restrictedDate" | "generic"
interface PayoutError {
  kind: PayoutErrorKind
  day?: string
  date?: string
  reason: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LOCK_HOURS = 30
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function getUnlockTime(lastUpdated: string): Date {
  return new Date(new Date(lastUpdated).getTime() + LOCK_HOURS * 60 * 60 * 1000)
}

function isWithdrawable(lastUpdated: string | null | undefined): boolean {
  if (!lastUpdated) return false
  return Date.now() >= getUnlockTime(lastUpdated).getTime()
}

function timeUntilWithdrawable(lastUpdated: string): string {
  const diffMs = getUnlockTime(lastUpdated).getTime() - Date.now()
  if (diffMs <= 0) return ""
  const totalSeconds = Math.floor(diffMs / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h >= 24) { const d = Math.floor(h / 24); return `Available in ${d}d ${h % 24}h ${m}m` }
  return `Available in ${h}h ${m}m ${s}s`
}

function unlockProgress(lastUpdated: string): number {
  const start = new Date(lastUpdated).getTime()
  const end   = getUnlockTime(lastUpdated).getTime()
  const now   = Date.now()
  if (now >= end) return 100
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
}

function classifyPayoutError(rawMessage: string, txnDate: string): PayoutError {
  const lower = rawMessage.toLowerCase()

  if (lower.includes(txnDate)) {
    return { kind: "restrictedDate", date: txnDate, reason: rawMessage }
  }

  const matchedDay = DAYS.find((d) => lower.includes(d.toLowerCase()))
  if (matchedDay && (lower.includes("restricted") || lower.includes("processing"))) {
    return { kind: "restrictedDay", day: matchedDay, reason: rawMessage }
  }

  return { kind: "generic", reason: rawMessage }
}

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  pending:      { label: "Pending",      bg: "bg-amber-100", text: "text-amber-700",  icon: <Clock size={11} /> },
  initializing: { label: "Initializing", bg: "bg-amber-100", text: "text-amber-700",  icon: <Loader2 size={11} className="animate-spin" /> },
  processing:   { label: "Processing",   bg: "bg-blue-100",  text: "text-blue-700",   icon: <Loader2 size={11} className="animate-spin" /> },
  failed:       { label: "Failed",       bg: "bg-red-100",   text: "text-red-700",    icon: <AlertCircle size={11} /> },
  successful:   { label: "Successful",   bg: "bg-green-100", text: "text-green-700",  icon: <CheckCircle size={11} /> },
  reversed:     { label: "Reversed",     bg: "bg-gray-100",  text: "text-gray-600",   icon: <X size={11} /> },
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function PayoutErrorBanner({ error, onDismiss }: { error: PayoutError; onDismiss: () => void }) {
  const base = "rounded-xl p-4 flex gap-3"

  if (error.kind === "restrictedDay") {
    return (
      <div className={`bg-orange-50 border border-orange-200 ${base}`}>
        <Ban size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-800">Payouts unavailable for this day</p>
          <p className="text-sm text-orange-700 mt-0.5">
            We aren&apos;t processing payouts on <strong>{error.day}s</strong>. {error.reason}
          </p>
        </div>
        <button onClick={onDismiss} className="text-orange-400 hover:text-orange-600 flex-shrink-0"><X size={16} /></button>
      </div>
    )
  }

  if (error.kind === "restrictedDate") {
    return (
      <div className={`bg-orange-50 border border-orange-200 ${base}`}>
        <CalendarX size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-800">This date is restricted</p>
          <p className="text-sm text-orange-700 mt-0.5">Payouts for <strong>{error.date}</strong> are not being processed. {error.reason}</p>
        </div>
        <button onClick={onDismiss} className="text-orange-400 hover:text-orange-600 flex-shrink-0"><X size={16} /></button>
      </div>
    )
  }

  return (
    <div className={`bg-red-50 border border-red-200 ${base}`}>
      <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-700">Payout request failed</p>
        <p className="text-sm text-red-600 mt-0.5">{error.reason}</p>
      </div>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={16} /></button>
    </div>
  )
}

// ─── Transaction Card ─────────────────────────────────────────────────────────

interface TxnCardProps {
  txn: DailyVoteTransaction
  payoutStatus: string | null
  /** The Supabase payout reference for this date, if one exists — lets the
   *  badge be clicked to reopen the live progress dialog while a payout
   *  is still in flight (initializing/processing). */
  payoutReference?: string | null
  onPayout: (txn: DailyVoteTransaction) => void
  /** Reopens the live PayoutStateDialog for an in-flight payout. */
  onReopen: (reference: string) => void
  onAddMethod: () => void
  hasMethods: boolean
  isSelected?: boolean
  onToggleSelect?: (date: string) => void
  /** False for a poll team member — they can see everything on this card
   *  but the action button becomes a disabled "View only" state instead
   *  of a working Payout button, and the bulk-select checkbox is hidden. */
  canPayout: boolean
}

function TxnCard({ txn, payoutStatus, payoutReference, onPayout, onReopen, onAddMethod, hasMethods, isSelected, onToggleSelect, canPayout }: TxnCardProps) {
  const canWithdraw = isWithdrawable(txn.lastUpdated)
  const timeLeft = timeUntilWithdrawable(txn.lastUpdated)
  const progress = unlockProgress(txn.lastUpdated)
  const badge = payoutStatus ? (STATUS_BADGE[payoutStatus] ?? STATUS_BADGE.pending) : null
  // A "failed" payout doesn't reserve this date — see hasActiveOrSuccessfulPayout in lib/payout-db.ts.
  const blockingStatus = Boolean(payoutStatus) && payoutStatus !== "failed"
  const isEligibleForBulk = !blockingStatus && canWithdraw && canPayout
  // Still in flight and we know its reference — the badge can reopen the
  // live progress dialog instead of just sitting there disabled.
  const isReopenable =
    blockingStatus && (payoutStatus === "initializing" || payoutStatus === "processing") && Boolean(payoutReference)

  return (
    <div className={`bg-white border rounded-xl p-5 hover:shadow-md transition-all space-y-4 ${
      isSelected && isEligibleForBulk
        ? "border-[#6b2fa5] bg-purple-50/30"
        : "border-gray-200"
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isEligibleForBulk && onToggleSelect && (
              <input
                type="checkbox"
                checked={isSelected ?? false}
                onChange={() => onToggleSelect(txn.date)}
                className="w-4 h-4 rounded border-gray-300 accent-[#6b2fa5] cursor-pointer"
              />
            )}
            <span className="font-bold text-gray-900 text-base">{txn.date}</span>

            {badge && (
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${badge.bg} ${badge.text}`}>
                {badge.icon}
                {badge.label}
              </span>
            )}

            {!blockingStatus && canWithdraw && (
              <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                <Shield size={11} />
                Ready
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>
              <span className="font-semibold text-gray-800">{txn.voteCount}</span>{" "}
              vote{txn.voteCount !== 1 ? "s" : ""}
            </span>
            <span>
              Sales:{" "}
              <span className="font-semibold text-gray-800">
                ₦{Number(txn.voteSales).toLocaleString()}
              </span>
            </span>
          </div>
        </div>

        <div className="flex-shrink-0">
          {blockingStatus ? (
            <button
              onClick={isReopenable ? () => onReopen(payoutReference as string) : undefined}
              disabled={!isReopenable}
              title={isReopenable ? "View live payout progress" : undefined}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                isReopenable ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed"
              } ${
                badge ? `${badge.bg} ${badge.text}` : "bg-gray-100 text-gray-500"
              }`}
            >
              {badge?.icon}
              {badge?.label ?? payoutStatus}
            </button>
          ) : !canPayout ? (
            <button
              disabled
              title="Only the poll creator can initiate a payout"
              className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-not-allowed bg-gray-100 text-gray-400"
            >
              View only
            </button>
          ) : (
            <button
              onClick={() => {
                if (!hasMethods) { onAddMethod(); return }
                if (canWithdraw) onPayout(txn)
              }}
              disabled={!canWithdraw}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
                canWithdraw
                  ? "bg-[#6b2fa5] text-white hover:bg-[#5a2589] shadow-sm"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {canWithdraw ? (
                <>Payout <ChevronRight size={14} /></>
              ) : (
                <><Clock size={14} /> Locked</>
              )}
            </button>
          )}
        </div>
      </div>

      {!blockingStatus && !canWithdraw && txn.lastUpdated && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
              <Clock size={12} />
              {timeLeft}
            </span>
            <span className="text-xs text-gray-400">{Math.round(progress)}% unlocked</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progress}%`,
                background: progress >= 80 ? "#7c3aed" : progress >= 50 ? "#f59e0b" : "#d1d5db",
              }}
            />
          </div>
          <p className="text-xs text-gray-400">
            Last vote: {new Date(txn.lastUpdated).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Active view types ────────────────────────────────────────────────────────

type ActiveView = "transactions" | "logs"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PollPayoutPage() {
  const router = useRouter()
  const params = useParams()
  const pollId = params.pollId as string

  const [poll,    setPoll]    = useState<Poll | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUid, setCurrentUid] = useState<string>("")

  const [transactions, setTransactions] = useState<DailyVoteTransaction[]>([])
  const [txnLoading,   setTxnLoading]   = useState(true)
  const [txnError,     setTxnError]     = useState<string | null>(null)

  const [payoutStatuses, setPayoutStatuses] = useState<Record<string, string>>({})
  // date → Supabase payout reference, so an in-flight badge can reopen the
  // live dialog. Populated from the status fetch and from a fresh submission.
  const [payoutRefs, setPayoutRefs] = useState<Record<string, string>>({})
  const [methods,        setMethods]        = useState<PayoutMethod[]>([])
  const [methodsLoading, setMethodsLoading] = useState(true)

  const [activeView,   setActiveView]   = useState<ActiveView>("transactions")
  const [dialogTxn,    setDialogTxn]    = useState<DailyVoteTransaction | null>(null)
  const [payoutError,  setPayoutError]  = useState<PayoutError | null>(null)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [bulkPayoutTxns, setBulkPayoutTxns] = useState<DailyVoteTransaction[]>([])

  // Live payout progress dialog — opened the moment a payout begins.
  const [liveReferences, setLiveReferences] = useState<string[] | null>(null)

  // Live ticker for countdown
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Auth + load poll ───────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      let token = getAccessToken()
      if (!token) {
        const refreshed = await tryRefreshTokens()
        if (!refreshed) { router.push("/login"); return }
        token = getAccessToken()
      }
      if (!token) { router.push("/login"); return }

      const meRes = await authFetch("/api/user/me")
      if (meRes.ok) {
        const me = await meRes.json()
        setCurrentUid(me.uid ?? me.userId ?? me.id ?? "")
      }

      const res = await authFetch("/api/polls/list")
      if (res.ok) {
        const data = await res.json()
        const found = (data.polls ?? []).find((p: Poll) => p.id === pollId)
        if (!found) { router.push("/polls"); return }
        setPoll(found)
      }
      setLoading(false)
    }
    init()
  }, [pollId, router])

  const fetchTransactions = useCallback(async () => {
    setTxnLoading(true)
    setTxnError(null)
    try {
      const res = await authFetch(`/api/polls/payout?pollId=${pollId}&action=list`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch transactions")
      setTransactions(data.transactions ?? [])
    } catch (err: any) {
      setTxnError(err.message || "Failed to load transaction data")
    } finally {
      setTxnLoading(false)
    }
  }, [pollId])

  const fetchPayoutStatuses = useCallback(async () => {
    try {
      const res = await authFetch(`/api/polls/payout?pollId=${pollId}&action=status`)
      const data = await res.json()
      if (!res.ok) return
      const records: Array<{ date: string; status: string; reference?: string }> = data.payouts ?? []
      const statusMap: Record<string, string> = {}
      const refMap: Record<string, string> = {}
      // Kept in the map (including "failed") so the badge still shows —
      // gating on whether a NEW request is allowed uses blockingStatus in
      // TxnCard, not presence in this map, since a failed attempt doesn't
      // reserve the date (see hasActiveOrSuccessfulPayout).
      for (const r of records) {
        statusMap[r.date] = r.status
        if (r.reference) refMap[r.date] = r.reference
      }
      setPayoutStatuses(statusMap)
      setPayoutRefs((prev) => ({ ...prev, ...refMap }))
    } catch {
      // Non-critical
    }
  }, [pollId])

  const fetchMethods = useCallback(async () => {
    setMethodsLoading(true)
    try {
      const res = await authFetch("/api/payout/method")
      if (res.ok) {
        const data = await res.json()
        setMethods(data.methods ?? [])
      }
    } finally {
      setMethodsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!loading) {
      fetchTransactions()
      fetchPayoutStatuses()
      fetchMethods()
    }
  }, [loading, fetchTransactions, fetchPayoutStatuses, fetchMethods])

  // Ready count excludes dates with an active or successful payout — a
  // "failed" one doesn't block a fresh request for that date.
  const readyCount = transactions.filter(
    (t) => isWithdrawable(t.lastUpdated) && (!payoutStatuses[t.date] || payoutStatuses[t.date] === "failed")
  ).length

  function handlePayoutSuccess(references: string[]) {
    // Same order as the transactions array PollPayoutConfirmation was given
    // (bulk selection or the single dialogTxn) — it only calls onSuccess
    // once every request in that loop succeeded, so the two arrays line up.
    const submittedTxns = bulkPayoutTxns.length > 0 ? bulkPayoutTxns : dialogTxn ? [dialogTxn] : []
    if (submittedTxns.length === references.length) {
      setPayoutRefs((prev) => {
        const next = { ...prev }
        submittedTxns.forEach((t, i) => { next[t.date] = references[i] })
        return next
      })
    }
    setSelectedDates(new Set())
    setBulkPayoutTxns([])
    fetchPayoutStatuses()
    if (references.length) setLiveReferences(references)
  }

  // Fires on every live SSE event for any reference currently shown in the
  // dialog — mirrors that status onto the Transaction Days list instantly,
  // so a card resolving to successful/failed shows up there without the
  // person needing to refresh or even keep the dialog open.
  function handleLiveStatusChange(state: PayoutLiveState) {
    setPayoutStatuses((prev) => {
      const date = Object.keys(payoutRefs).find((d) => payoutRefs[d] === state.reference)
      if (!date || prev[date] === state.status) return prev
      return { ...prev, [date]: state.status }
    })
  }

  function handleReopenPayout(reference: string) {
    setLiveReferences([reference])
  }

  function handlePayoutError(rawMessage: string, txnDate: string) {
    setPayoutError(classifyPayoutError(rawMessage, txnDate))
  }

  function handleBulkPayoutClick() {
    if (selectedDates.size === 0) return
    const txnsToProcess = transactions.filter((t) => selectedDates.has(t.date))
    setBulkPayoutTxns(txnsToProcess)
    setDialogTxn(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading || !poll) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-7 h-7 animate-spin text-[#6b2fa5]" />
      </div>
    )
  }

  const hasMethods  = methods.length > 0
  const available   = Math.max(0, (poll.pollAmount ?? 0) - (poll.totalPaidOut ?? 0))
  const isLocked    = poll.flagged || poll.suspended
  // A poll team member sees everything on this page but can't initiate a
  // payout — the server enforces this too (POST /api/polls/payout stays
  // creator-only), this just keeps the buttons honest about it.
  const canPayout   = poll.role !== "member"

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Live payout progress — SSE-backed */}
        {liveReferences && (
          <PayoutStateDialog references={liveReferences} onClose={() => setLiveReferences(null)} onStatusChange={handleLiveStatusChange} />
        )}

        {/* Payout Confirmation Dialog */}
        {(dialogTxn || bulkPayoutTxns.length > 0) && (
          <PollPayoutConfirmation
            txns={bulkPayoutTxns.length > 0 ? bulkPayoutTxns : dialogTxn!}
            methods={methods}
            pollId={pollId}
            onSuccess={handlePayoutSuccess}
            onError={(msg) => {
              const refDate = bulkPayoutTxns.length > 0 ? "" : dialogTxn?.date ?? ""
              handlePayoutError(msg, refDate)
            }}
            onClose={() => { setDialogTxn(null); setBulkPayoutTxns([]) }}
          />
        )}

        {/* Back */}
        <Link
          href={`/polls/${pollId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Poll
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#6b2fa5] rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Poll Payouts</h1>
            <p className="text-sm text-gray-500 truncate max-w-xs">{poll.pollName}</p>
          </div>
        </div>

        {/* Flagged / suspended banner */}
        {isLocked && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 mb-6">
            <Ban size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              {poll.flagged
                ? "This poll has been flagged by Spotix. Payouts are disabled. Please contact customer support with your poll ID for more information."
                : "This poll has been suspended by Spotix. Payouts are currently disabled. Please contact support."}
            </p>
          </div>
        )}

        {/* Info notice */}
        {!isLocked && canPayout && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 mb-6">
            <AlertCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              Payouts are available per transaction day. Withdrawals unlock{" "}
              <strong>30 hours</strong> after the last vote on that day. Make sure you have a
              payout method set before requesting.
            </p>
          </div>
        )}

        {/* Team-member notice — view only */}
        {!canPayout && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex gap-3 mb-6">
            <Shield size={16} className="text-[#6b2fa5] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-purple-700">
              You're on this poll's team, so you can see all transactions and payout history below —
              only the poll creator can initiate a payout.
            </p>
          </div>
        )}

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 rounded-lg"><TrendingUp size={16} className="text-blue-600" /></div>
            </div>
            <p className="text-xs text-gray-400 font-medium">Total Revenue</p>
            <p className="text-xl font-bold text-gray-900">₦{(poll.pollAmount ?? 0).toLocaleString()}</p>
          </div>

          <div className="bg-white border border-purple-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-purple-100 rounded-lg"><Wallet size={16} className="text-[#6b2fa5]" /></div>
            </div>
            <p className="text-xs text-gray-400 font-medium">Available</p>
            <p className="text-xl font-bold text-[#6b2fa5]">₦{available.toLocaleString()}</p>
          </div>

          <div className="bg-white border border-green-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-green-100 rounded-lg"><CheckCircle size={16} className="text-green-600" /></div>
            </div>
            <p className="text-xs text-gray-400 font-medium">Paid Out</p>
            <p className="text-xl font-bold text-green-600">
              ₦{(poll.totalPaidOut ?? 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* ── Payout Error Banner ────────────────────────────────────────── */}
        {payoutError && <div className="mb-5"><PayoutErrorBanner error={payoutError} onDismiss={() => setPayoutError(null)} /></div>}

        {/* ── Sub-tabs ───────────────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto overflow-y-hidden">
          <button
            onClick={() => setActiveView("transactions")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px flex items-center gap-2 whitespace-nowrap
              ${activeView === "transactions" ? "border-[#6b2fa5] text-[#6b2fa5]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Calendar size={14} />
            Transaction Days
            {readyCount > 0 && (
              <span className="bg-[#6b2fa5] text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {readyCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView("logs")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px flex items-center gap-2 whitespace-nowrap
              ${activeView === "logs" ? "border-[#6b2fa5] text-[#6b2fa5]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <ReceiptText size={14} />
            Payout Logs
          </button>
        </div>

        {/* ── Transaction Days view ─────────────────────────────────────── */}
        {activeView === "transactions" && (
          <div>
            {!methodsLoading && !hasMethods && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <p className="text-sm text-yellow-800 font-medium">No bank account added</p>
                <p className="text-xs text-yellow-700 mt-0.5">
                  Go to <strong>Profile → Payout Methods</strong> to add a bank account before requesting.
                </p>
              </div>
            )}

            {txnLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-3">
                  <Loader2 size={32} className="animate-spin text-[#6b2fa5] mx-auto" />
                  <p className="text-sm text-gray-400">Loading transactions...</p>
                </div>
              </div>
            ) : txnError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Failed to load</p>
                  <p className="text-sm text-red-600 mt-0.5">{txnError}</p>
                  <button onClick={fetchTransactions} className="text-xs text-red-600 underline mt-2 font-medium">
                    Try again
                  </button>
                </div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
                <div className="p-3 bg-gray-100 rounded-full w-fit mx-auto mb-3">
                  <Calendar size={28} className="text-gray-400" />
                </div>
                <p className="text-gray-600 font-semibold">No transactions yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Transaction records will appear here once votes are cast.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {hasMethods && !isLocked && canPayout && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-purple-900">Bulk Payout</p>
                      <p className="text-xs text-purple-700 mt-0.5">
                        Select multiple available days to pay into your primary account at once
                      </p>
                    </div>
                    <button
                      onClick={handleBulkPayoutClick}
                      disabled={selectedDates.size === 0}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
                        selectedDates.size > 0
                          ? "bg-[#6b2fa5] text-white hover:bg-[#5a2589]"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Payout {selectedDates.size > 0 ? `(${selectedDates.size})` : ""}
                    </button>
                  </div>
                )}

                {transactions.map((txn) => (
                  <TxnCard
                    key={txn.date}
                    txn={txn}
                    payoutStatus={payoutStatuses[txn.date] ?? null}
                    payoutReference={payoutRefs[txn.date] ?? null}
                    hasMethods={hasMethods && !isLocked}
                    canPayout={canPayout}
                    onPayout={(t) => { if (!isLocked && canPayout) setDialogTxn(t) }}
                    onReopen={handleReopenPayout}
                    onAddMethod={() => router.push("/profile")}
                    isSelected={selectedDates.has(txn.date)}
                    onToggleSelect={(date) => {
                      const next = new Set(selectedDates)
                      if (next.has(date)) next.delete(date)
                      else next.add(date)
                      setSelectedDates(next)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Payout Logs view ──────────────────────────────────────────── */}
        {activeView === "logs" && (
          <PollPayoutLog pollId={pollId} userId={currentUid} canManagePayouts={canPayout} />
        )}

      </div>
    </div>
  )
}
