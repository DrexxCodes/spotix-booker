"use client"

/**
 * app/elections/[electionId]/components/PayoutTab.tsx
 *
 * Lists daily form-fee transaction totals (admin/elections/{id}/{date}
 * in Firestore) and lets the organiser request a payout for any date —
 * same 30-hour-after-last-purchase rule as events/polls, enforced
 * server-side in /api/elections/[id]/payout (this component just
 * surfaces whatever error message that route returns, e.g. "Available
 * in 6h 20m").
 *
 * Reuses the existing PayoutStatusCard + its live status stream once a
 * payout reference exists — that component is reference-based and
 * doesn't care whether the reference came from an event, poll, or
 * election payout.
 */

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import PayoutStatusCard from "@/components/payout/PayoutStatusCard"

interface DailyTotal {
  date: string
  totalAmount: number
  formCount: number
}

export function PayoutTab({ electionId }: { electionId: string }) {
  const [transactions, setTransactions] = useState<DailyTotal[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeReference, setActiveReference] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [requestingDate, setRequestingDate] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    Promise.all([
      fetch(`/api/elections/${electionId}/payout?action=list`).then((r) => r.json()),
      fetch(`/api/elections/${electionId}/payout?action=status`).then((r) => r.json()),
    ])
      .then(([listData, statusData]) => {
        setTransactions(listData.transactions ?? [])
        setPayouts(statusData.payouts ?? [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(reload, [electionId])

  async function requestPayout(date: string, amount: number) {
    setRequestingDate(date)
    setRequestError(null)
    try {
      const res = await fetch(`/api/elections/${electionId}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ date, amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to request payout")
      setActiveReference(data.reference)
      reload()
    } catch (err: any) {
      setRequestError(err.message)
    } finally {
      setRequestingDate(null)
    }
  }

  const payoutForDate = (date: string) => payouts.find((p) => p.date === date)

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>

  return (
    <div>
      {activeReference && (
        <div className="mb-6">
          <PayoutStatusCard reference={activeReference} />
        </div>
      )}

      {requestError && <p className="mb-3 text-sm text-red-600">{requestError}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
            <th className="py-2">Date</th>
            <th className="py-2">Forms</th>
            <th className="py-2">Total</th>
            <th className="py-2">Status</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => {
            const existing = payoutForDate(t.date)
            return (
              <tr key={t.date} className="border-b border-gray-100">
                <td className="py-2">{t.date}</td>
                <td className="py-2">{t.formCount}</td>
                <td className="py-2">₦{t.totalAmount.toLocaleString()}</td>
                <td className="py-2 capitalize">{existing?.status ?? "—"}</td>
                <td className="py-2">
                  {!existing && (
                    <Button
                      variant="outline"
                      onClick={() => requestPayout(t.date, t.totalAmount)}
                      disabled={requestingDate === t.date}
                    >
                      {requestingDate === t.date ? "Requesting…" : "Withdraw"}
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {transactions.length === 0 && <p className="text-sm text-gray-500">No form-fee transactions yet.</p>}
    </div>
  )
}
