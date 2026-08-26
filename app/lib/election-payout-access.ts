/**
 * lib/election-payout-access.ts
 *
 * Ownership check for election payouts. Deliberately simpler than
 * lib/payout-access.ts: elections live in Supabase, not Firestore, and
 * don't (yet) participate in the `collaborations` collection that gives
 * events their Admin/Accountant/custom-role collaborator system. For
 * now, only the election's own organizer_id can request its payout —
 * see the note in the chat write-up about extending collaborator roles
 * to elections as a follow-up.
 */

import { getElection } from "@/lib/election-db"

export type ElectionPayoutAccessResult =
  | { ok: true; organizerId: string; election: Awaited<ReturnType<typeof getElection>> }
  | { ok: false; error: string; status: number }

export async function resolveElectionPayoutAccess(electionId: string, userId: string): Promise<ElectionPayoutAccessResult> {
  const election = await getElection(electionId)
  if (!election) return { ok: false, error: "Election not found", status: 404 }
  if (election.organizer_id !== userId) {
    return { ok: false, error: "Only this election's organizer can request its payout", status: 403 }
  }
  return { ok: true, organizerId: userId, election }
}
