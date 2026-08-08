/**
 * app/lib/poll-team-access.ts
 *
 * Shared access resolution for the Poll Teams feature. A poll has exactly
 * two access tiers (unlike the event-team feature in payout-access.ts,
 * which has admin/checkin/accountant/custom roles):
 *
 *   Poll Creator (owner)   → full access: edit, vote stats, poll settings
 *                             (the standalone /settings page), payouts.
 *   Poll Team Member       → edit page only (poll info, schedule, price,
 *                             contestants/categories, vote-stats visibility
 *                             toggle) and read access to vote stats/entries.
 *                             Cannot open the standalone Poll Settings page
 *                             (event linking) and cannot initiate payouts.
 *
 * Used by:
 *   - app/api/polls/one/route.ts     (fetch a single poll — owner or member)
 *   - app/api/polls/update/route.ts  (save edits — owner or member)
 *   - app/api/polls/entries/route.ts (view vote stats — owner or member)
 *   - app/api/polls/team/route.ts    (manage the team — owner only, except
 *                                      DELETE which also allows self-exit)
 *
 * app/api/polls/settings/route.ts and app/api/polls/payout/route.ts
 * intentionally do NOT use this helper — they stay strictly owner-only.
 */

import { adminDb } from "@/lib/firebase-admin"

export type PollAccessRole = "owner" | "member"

export type PollAccessResult =
  | {
      ok: true
      role: PollAccessRole
      ownerId: string
      pollSnap: FirebaseFirestore.DocumentSnapshot
    }
  | {
      ok: false
      error: string
      status: number
    }

export async function resolvePollAccess(
  pollId: string,
  userId: string
): Promise<PollAccessResult> {
  const pollRef  = adminDb.collection("voting").doc(pollId)
  const pollSnap = await pollRef.get()
  if (!pollSnap.exists) return { ok: false, error: "Poll not found", status: 404 }

  const d = pollSnap.data()!
  const ownerId = (d.creatorId ?? d.organizerId ?? null) as string | null

  if (ownerId && ownerId === userId) {
    return { ok: true, role: "owner", ownerId, pollSnap }
  }

  const collabSnap = await adminDb
    .collection("pollCollaborations")
    .where("pollId", "==", pollId)
    .where("collaboratorId", "==", userId)
    .where("isActive", "==", true)
    .limit(1)
    .get()

  if (collabSnap.empty) {
    return { ok: false, error: "Forbidden: you do not have access to this poll", status: 403 }
  }

  return { ok: true, role: "member", ownerId: ownerId ?? "", pollSnap }
}
