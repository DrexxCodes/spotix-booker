"use client"

/**
 * app/components/event-info/helper/vault-key-enter-onPayout.tsx
 *
 * Bottom-sheet dialog shown right after the requester (Event Creator or
 * Admin — the only roles that can ever reach this, since initiating a
 * payout is gated to them at /api/payout) submits a payout that lands in
 * "vault_pending".
 *
 * It tells them plainly: their request has gone out, every OTHER Vault
 * participant now needs to acknowledge it by entering their own Vault Key,
 * and — separately — the requester themselves still owes their own key
 * before the payout can clear at all.
 *
 * Submitting here calls the same PATCH /api/payout/vault route used by
 * vault-signoffs.tsx. That route marks the CURRENT user's key as verified
 * against every payoutId passed in — a bulk request creates one payout doc
 * per day, so the requester signs all of them with a single key entry here.
 */

import { useState } from "react"
import { ShieldCheck, KeyRound, Loader2, AlertCircle, X, Users } from "lucide-react"

interface VaultKeyEnterOnPayoutDialogProps {
  payoutIds: string[]
  amount: number
  dates: string[]
  onClose: () => void
  /** Fired once the current user's key has been accepted for every payoutId */
  onEntered: () => void
}

export default function VaultKeyEnterOnPayoutDialog({
  payoutIds,
  amount,
  dates,
  onClose,
  onEntered,
}: VaultKeyEnterOnPayoutDialogProps) {
  const [key, setKey] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const dayLabel = dates.length === 1 ? dates[0] : `${dates.length} days (${dates.join(", ")})`

  // Slide back down before actually unmounting, so "later" doesn't feel abrupt.
  function handleDismiss() {
    if (submitting) return
    setClosing(true)
    setTimeout(onClose, 200)
  }

  async function handleSubmit() {
    if (!key) return
    setSubmitting(true)
    setError(null)
    try {
      for (const payoutId of payoutIds) {
        const res = await fetch("/api/payout/vault", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payoutId, vaultKey: key }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Incorrect Vault Key")
      }
      onEntered()
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to submit Vault Key")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center transition-opacity duration-200 ${
        closing ? "opacity-0" : "opacity-100 animate-in fade-in"
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) handleDismiss() }}
    >
      <div
        className={`w-full max-w-md bg-white rounded-t-3xl shadow-2xl px-5 pt-3 pb-6 sm:pb-6 space-y-4 ${
          closing
            ? "animate-out slide-out-to-bottom duration-200"
            : "animate-in slide-in-from-bottom duration-300"
        }`}
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ShieldCheck size={16} className="text-[#6b2fa5]" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Payout request sent</h3>
          </div>
          <button onClick={handleDismiss} disabled={submitting} className="text-gray-400 hover:text-gray-700 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">
          Your payout request for{" "}
          <span className="font-semibold text-gray-900">{dayLabel}</span> (₦
          {Number(amount).toLocaleString()}) has been submitted.
        </p>

        {/* What happens next — other participants */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5 flex gap-2.5">
          <Users size={16} className="text-[#6b2fa5] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-purple-800 leading-relaxed">
            Every other Vault participant will now be asked to acknowledge this request by
            entering their own Vault Key before it can clear.
          </p>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed font-medium">
          You still need to enter your own Vault Key to sign off on your own request.
        </p>

        <input
          type="password"
          autoFocus
          placeholder="Your Vault Key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && key) handleSubmit() }}
          disabled={submitting}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] disabled:opacity-50"
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 flex gap-2">
            <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleDismiss}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            I&apos;ll do it later
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !key}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#6b2fa5] text-white hover:bg-[#5a2589] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={14} />}
            {submitting ? "Verifying..." : "Submit Key"}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          You can also do this later from the Vault sign-off section at the top of this page.
        </p>
      </div>
    </div>
  )
}
