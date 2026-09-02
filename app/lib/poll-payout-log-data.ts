/**
 * app/lib/poll-payout-log-data.ts
 *
 * Shared fetch for a poll's payout records — extracted out of
 * components/polls/helper/poll-payout-log.tsx so the poll payout export
 * can reuse the exact same source instead of re-implementing it.
 *
 * Polls have no Vault feature, so this is simpler than the event-side
 * payout-log-data.ts: every record here is a single Supabase `payouts`
 * row (GET /api/polls/payout?action=status). No cancel/reject state and
 * no vault holds to merge in.
 */

export type PollPayoutStatus = "initializing" | "processing" | "failed" | "successful"

export interface PollPayoutRecord {
  id: string // reference
  pollId: string
  userId: string
  date: string
  amount: number
  bankName: string
  accountNumber: string
  accountName: string
  status: PollPayoutStatus
  failureReason?: string | null
  narration?: string | null
  createdAt: string | null
  resolvedAt?: string | null
}

export const POLL_PAYOUT_STATUS_LABELS: Record<PollPayoutStatus, string> = {
  initializing: "Initializing",
  processing: "Processing",
  failed: "Failed",
  successful: "Successful",
}

export function formatPollPayoutStatusLabel(status: string | null | undefined): string {
  if (!status) return "Not requested"
  return POLL_PAYOUT_STATUS_LABELS[status as PollPayoutStatus] ?? status
}

export async function fetchPollPayoutRecords(pollId: string): Promise<PollPayoutRecord[]> {
  const res = await fetch(`/api/polls/payout?pollId=${pollId}&action=status`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to fetch payout logs")
  return data.payouts ?? []
}
