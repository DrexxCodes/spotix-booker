/**
 * app/lib/payout-log-data.ts
 *
 * Shared fetch + merge for an event's payout log timeline — extracted out
 * of helper/payout-log.tsx so the Payouts tab's CSV/PDF export can reuse
 * the exact same two-source merge instead of re-implementing it. Behavior
 * is unchanged from what payout-log.tsx used to do inline:
 *
 *   1. Supabase `payouts` — real money-movement attempts (GET
 *      /api/payout?action=status). initializing/processing/successful/failed.
 *   2. Firestore `vaultHolds` — pre-payout Vault sign-off state (GET
 *      /api/payout?action=vaultPending). vault_pending only; a released
 *      hold graduates into a payouts row and disappears from this list on
 *      the next refresh (it's now represented by its Supabase row instead).
 */

export type DisplayStatus =
  | "initializing"
  | "processing"
  | "successful"
  | "failed"
  | "vault_pending"
  | "cancelled"
  | "rejected"

export interface DisplayRecord {
  id: string // reference (Supabase) or holdId (Firestore vaultHold)
  source: "payout" | "vaultHold"
  date: string
  amount: number
  bankName: string
  accountNumber: string
  accountName: string
  status: DisplayStatus
  failureReason?: string | null
  narration?: string | null
  userId: string
  initiatedByName?: string
  createdAt: string | null
  resolvedAt?: string | null
  durationSeconds?: number
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  initializing: "Initializing",
  processing: "Processing",
  successful: "Successful",
  failed: "Failed",
  vault_pending: "Awaiting Vault Sign-off",
  cancelled: "Cancelled",
  rejected: "Rejected",
}

export function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return "Not requested"
  return STATUS_LABELS[status as DisplayStatus] ?? status
}

export async function fetchPayoutLogRecords(eventId: string): Promise<DisplayRecord[]> {
  const [statusRes, vaultRes] = await Promise.all([
    fetch(`/api/payout?eventId=${eventId}&action=status`),
    fetch(`/api/payout?eventId=${eventId}&action=vaultPending`),
  ])
  const statusData = await statusRes.json()
  const vaultData = await vaultRes.json()
  if (!statusRes.ok) throw new Error(statusData.error || "Failed to fetch payout logs")

  const payoutRecords: DisplayRecord[] = (statusData.payouts ?? []).map((p: any) => ({
    id: p.reference,
    source: "payout" as const,
    date: p.date,
    amount: p.amount,
    bankName: p.bankName,
    accountNumber: p.accountNumber,
    accountName: p.accountName,
    status: p.status as DisplayStatus,
    failureReason: p.failureReason,
    narration: p.narration,
    userId: p.userId,
    createdAt: p.createdAt,
    resolvedAt: p.resolvedAt,
    durationSeconds: p.durationSeconds,
  }))

  const holdRecords: DisplayRecord[] = vaultRes.ok
    ? (vaultData.payouts ?? []).map((h: any) => ({
        id: h.id,
        source: "vaultHold" as const,
        date: h.date,
        amount: h.amount,
        bankName: h.bankName,
        accountNumber: h.accountNumber,
        accountName: h.accountName,
        status: "vault_pending" as const,
        userId: h.userId,
        initiatedByName: h.initiatedByName,
        createdAt: h.createdAt?._seconds ? new Date(h.createdAt._seconds * 1000).toISOString() : h.createdAt ?? null,
      }))
    : []

  return [...holdRecords, ...payoutRecords].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bTime - aTime
  })
}
