"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Send, AlertCircle, CheckCircle, Clock, Search, Loader2, X,
  ArrowRightLeft, History, Ban, CircleCheck, CircleX, Timer,
} from "lucide-react"

interface TransferTabProps {
  eventId: string
  eventName: string
  organizerId: string
  currentUserId: string
}

interface RecipientInfo {
  userId: string
  email: string
  fullName: string
  username: string
}

interface TransferRecord {
  id: string
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired"
  recipientEmail: string
  recipientUsername: string
  recipientId: string
  createdAt: any
}

type Step = "input" | "confirm" | "success"

// ── Status pill for history ───────────────────────────────────────────────────
function StatusPill({ status }: { status: TransferRecord["status"] }) {
  const map: Record<TransferRecord["status"], { label: string; cls: string; icon: React.ReactNode }> = {
    pending:   { label: "Pending",   cls: "bg-amber-50 text-amber-700 border-amber-200",   icon: <Timer size={11} /> },
    accepted:  { label: "Accepted",  cls: "bg-green-50 text-green-700 border-green-200",   icon: <CircleCheck size={11} /> },
    rejected:  { label: "Rejected",  cls: "bg-red-50 text-red-700 border-red-200",         icon: <CircleX size={11} /> },
    cancelled: { label: "Cancelled", cls: "bg-slate-50 text-slate-600 border-slate-200",   icon: <X size={11} /> },
    expired:   { label: "Expired",   cls: "bg-slate-50 text-slate-500 border-slate-200",   icon: <Clock size={11} /> },
  }
  const cfg = map[status] ?? map.expired
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function formatTs(ts: any): string {
  const date = toDateSafe(ts)
  if (!date) return "—"
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
}

// Normalizes a Firestore Timestamp (or its serialized { _seconds, _nanoseconds }
// shape returned over JSON), an ISO string, or a millis number into a Date.
function toDateSafe(ts: any): Date | null {
  if (!ts) return null
  try {
    let date: Date
    if (typeof ts?.toDate === "function") {
      date = ts.toDate()
    } else if (typeof ts?._seconds === "number") {
      date = new Date(ts._seconds * 1000 + Math.floor((ts._nanoseconds ?? 0) / 1e6))
    } else if (typeof ts?.seconds === "number") {
      date = new Date(ts.seconds * 1000 + Math.floor((ts.nanoseconds ?? 0) / 1e6))
    } else {
      date = new Date(ts)
    }
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

const TRANSFER_TTL_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

// Whole days left before a pending transfer expires (never negative, rounds up).
function daysLeft(createdAt: any): number {
  const created = toDateSafe(createdAt)
  if (!created) return 0
  const remainingMs = created.getTime() + TRANSFER_TTL_MS - Date.now()
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
}

export default function TransferTab({
  eventId,
  eventName,
  organizerId,
  currentUserId,
}: TransferTabProps) {
  const isOwner = organizerId === currentUserId

  // ─── Pending transfer state ─────────────────────────────────────────────
  const [pendingTransfer, setPendingTransfer] = useState<TransferRecord | null | undefined>(undefined)
  const [pendingLoading, setPendingLoading] = useState(true)

  // ─── Transfer history ───────────────────────────────────────────────────
  const [history, setHistory] = useState<TransferRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // ─── Form state ─────────────────────────────────────────────────────────
  const [email, setEmail] = useState("")
  const [recipient, setRecipient] = useState<RecipientInfo | null>(null)
  const [step, setStep] = useState<Step>("input")

  // ─── Async state ────────────────────────────────────────────────────────
  const [lookupLoading, setLookupLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── On mount: check for pending transfer + load history ────────────────
  const fetchPendingAndHistory = useCallback(async () => {
    setPendingLoading(true)
    setHistoryLoading(true)

    try {
      const [pendingRes, historyRes] = await Promise.all([
        fetch(`/api/event/transfer?eventId=${eventId}`),
        fetch(`/api/event/transfer?eventId=${eventId}&history=true`),
      ])

      if (pendingRes.ok) {
        const data = await pendingRes.json()
        const t = data.transfer ?? null
        setPendingTransfer(t)
        // If there's a pending transfer, jump to success step pre-filled
        if (t && t.status === "pending") {
          setRecipient({
            userId: t.recipientId,
            email: t.recipientEmail,
            fullName: t.recipientUsername ?? "",
            username: t.recipientUsername ?? "",
          })
          setStep("success")
        }
      } else {
        setPendingTransfer(null)
      }

      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistory(data.history ?? [])
      }
    } catch {
      setPendingTransfer(null)
    } finally {
      setPendingLoading(false)
      setHistoryLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchPendingAndHistory()
  }, [fetchPendingAndHistory])

  // ─────────────────────────────────────────────────────────────────────────
  const handleLookup = async () => {
    setError(null)
    setRecipient(null)

    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.")
      return
    }

    setLookupLoading(true)
    try {
      const res = await fetch(
        `/api/user/whoru?type=email&value=${encodeURIComponent(trimmed)}&limit=1`
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === "User not found"
          ? "No Spotix account found for that email."
          : data.error || "Failed to look up user.")
        return
      }
      if (data.userId === currentUserId) {
        setError("You cannot transfer an event to yourself.")
        return
      }
      setRecipient({
        userId: data.userId,
        email: data.email,
        fullName: data.fullName,
        username: data.username,
      })
      setStep("confirm")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLookupLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!recipient) return
    setError(null)
    setSubmitLoading(true)

    try {
      const res = await fetch("/api/event/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          eventId,
          recipientEmail: recipient.email,
          recipientId: recipient.userId,
          recipientUsername: recipient.username,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to send transfer request.")
        setStep("confirm")
        return
      }
      setPendingTransfer({ id: data.transferId, status: "pending", recipientEmail: recipient.email, recipientUsername: recipient.username, recipientId: recipient.userId, createdAt: new Date() })
      setStep("success")
      // Refresh history
      fetchPendingAndHistory()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!pendingTransfer) return
    setError(null)
    setCancelLoading(true)

    try {
      const res = await fetch("/api/event/transfer", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, transferId: pendingTransfer.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to cancel the transfer.")
        return
      }
      setStep("input")
      setEmail("")
      setRecipient(null)
      setPendingTransfer(null)
      fetchPendingAndHistory()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setCancelLoading(false)
    }
  }

  // ─── Not owner guard ─────────────────────────────────────────────────────
  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <AlertCircle size={32} className="text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">Not the Event Owner</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          Only the event organizer can transfer ownership of this event.
        </p>
      </div>
    )
  }

  // ─── Loading state ───────────────────────────────────────────────────────
  if (pendingLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[#6b2fa5]" />
      </div>
    )
  }

  const hasPending = pendingTransfer?.status === "pending"

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Pending-transfer block — shown at top when a transfer exists ── */}
      {hasPending && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <Ban size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-900 space-y-1">
            <p className="font-semibold">Transfer already in progress</p>
            <p className="text-amber-800">
              A transfer request to{" "}
              <span className="font-semibold">@{pendingTransfer?.recipientUsername}</span> is
              pending. Cancel it below before initiating a new one.
            </p>
          </div>
        </div>
      )}

      {/* Info banner */}
      {!hasPending && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <Clock size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold">Transfer Event Ownership</p>
            <p className="text-blue-800 mt-1">
              The recipient will have 3 days to accept. Once accepted, they become the organizer
              and gain full control over this event.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP: input ────────────────────────────────────────────────── */}
      {step === "input" && !hasPending && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <label htmlFor="recipientEmail" className="block text-sm font-semibold text-slate-700 mb-2">
              Recipient Email Address
            </label>
            <div className="flex gap-2">
              <input
                id="recipientEmail"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="user@example.com"
                disabled={lookupLoading}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 text-sm"
              />
              <button
                onClick={handleLookup}
                disabled={lookupLoading || !email.trim()}
                className="px-4 py-2.5 rounded-lg font-semibold flex items-center gap-2 bg-[#6b2fa5] text-white hover:bg-[#5a2589] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {lookupLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                {lookupLoading ? "Looking up..." : "Find User"}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Enter the Spotix account email of the person you want to transfer this event to.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* ── STEP: confirm ──────────────────────────────────────────────── */}
      {step === "confirm" && recipient && !hasPending && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <p className="text-sm font-semibold text-slate-600 mb-3">Transferring to</p>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-11 h-11 rounded-full bg-[#6b2fa5]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[#6b2fa5] font-bold text-base">
                  {recipient.username?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">@{recipient.username}</p>
                <p className="text-sm text-slate-500 truncate">{recipient.email}</p>
                {recipient.fullName && (
                  <p className="text-xs text-slate-400 truncate">{recipient.fullName}</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <ArrowRightLeft size={17} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">
              <span className="font-semibold">@{recipient.username}</span> will gain full
              control over <span className="font-semibold">{eventName}</span> once they accept.
              This action cannot be undone after acceptance.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setStep("input"); setRecipient(null); setError(null) }}
              disabled={submitLoading}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors text-sm"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitLoading}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 bg-[#6b2fa5] text-white hover:bg-[#5a2589] disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {submitLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {submitLoading ? "Sending..." : "Send Transfer Request"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: success / pending exists ────────────────────────────── */}
      {(step === "success" || hasPending) && recipient && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-3">
              <Clock size={28} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Awaiting Acceptance</h3>
            <p className="text-sm text-slate-500">
              Transfer request sent to{" "}
              <span className="font-semibold text-slate-700">@{recipient.username}</span>.
              {" "}
              {(() => {
                const left = daysLeft(pendingTransfer?.createdAt)
                return left > 0
                  ? `Transfer expires in ${left} day${left !== 1 ? "s" : ""}.`
                  : "Transfer expires soon."
              })()}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            onClick={handleCancel}
            disabled={cancelLoading}
            className="w-full px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {cancelLoading ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
            {cancelLoading ? "Cancelling..." : "Cancel Transfer Request"}
          </button>
        </div>
      )}

      {/* ── Transfer History ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History size={15} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Transfer History</h3>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No transfer history yet.</p>
        ) : (
          /* Horizontal scrollable row of cards */
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3" style={{ width: "max-content" }}>
              {history.map((t) => (
                <div
                  key={t.id}
                  className="flex-shrink-0 w-56 bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#6b2fa5]/10 flex items-center justify-center text-[#6b2fa5] font-bold text-sm flex-shrink-0">
                      {(t.recipientUsername?.[0] ?? "?").toUpperCase()}
                    </div>
                    <StatusPill status={t.status} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      @{t.recipientUsername ?? "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{t.recipientEmail}</p>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={10} />
                    {formatTs(t.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h3 className="font-semibold text-slate-800">Frequently Asked Questions</h3>

        {[
          {
            q: "What happens when I transfer an event?",
            a: (
              <>
                <p>The recipient becomes the event organizer and gains full control, including:</p>
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>Managing attendees and check-ins</li>
                  <li>Editing event details</li>
                  <li>Processing payouts</li>
                  <li>Viewing analytics and reports</li>
                </ul>
              </>
            ),
          },
          {
            q: "How long does the recipient have to accept?",
            a: "The recipient has 3 days to accept or reject. After that, the request expires automatically.",
          },
          {
            q: "Can I cancel a transfer request?",
            a: 'Yes — after sending a request, a "Cancel Transfer Request" button will appear on this page.',
          },
        ].map(({ q, a }) => (
          <details key={q} className="group">
            <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 p-4 font-medium text-slate-800 hover:bg-slate-100 text-sm">
              {q}
              <span className="transition-transform group-open:rotate-180 text-slate-400">▼</span>
            </summary>
            <div className="rounded-b-lg bg-slate-50 px-4 pb-4 text-sm text-slate-600">{a}</div>
          </details>
        ))}
      </div>
    </div>
  )
}
