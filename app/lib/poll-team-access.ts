/**
 * app/lib/poll-team-access.ts
 *
 * Shared access resolution for the Poll Teams feature. A poll has exactly
 * two access tiers (unlike the event-team feature in payout-access.ts,
 * which has admin/checkin/accountant/custom roles):
 *
 *   Poll Creator (owner)   → full access: edit, vote stats, the command
 *                             center, poll settings (the standalone
 *                             /settings page), and payouts — including
 *                             initiating payouts and adding team members.
 *   Poll Team Member       → the same read surface as the creator (command
 *                             center, edit page, vote stats/entries, the
 *                             Settings page, the Payout page) MINUS the
 *                             ability to initiate a payout and MINUS the
 *                             ability to add new team members — unless the
 *                             creator has granted them the `canAddAdmin`
 *                             privilege on their pollCollaborations doc, in
 *                             which case they can add teammates too (but
 *                             still can never initiate a payout, and can
 *                             never grant/revoke canAddAdmin themselves —
 *                             that stays creator-only).
 *
 * Used by:
 *   - app/api/polls/one/route.ts      (fetch a single poll — owner or member)
 *   - app/api/polls/list/route.ts     (dashboard listing — owner AND member,
 *                                       queried separately then merged, see
 *                                       that file for why it doesn't call
 *                                       this helper directly)
 *   - app/api/polls/update/route.ts   (save edits — owner or member)
 *   - app/api/polls/entries/route.ts  (view vote stats — owner or member)
 *   - app/api/polls/settings/route.ts (GET is owner or member; the
 *                                       link/unlink POST stays owner-only)
 *   - app/api/polls/payout/route.ts   (GET — list/status — is owner or
 *                                       member; POST/PATCH, which create or
 *                                       re-queue a payout, stay owner-only)
 *   - app/api/polls/team/route.ts     (GET list is owner or member; POST add
 *                                       is owner or member-with-canAddAdmin;
 *                                       DELETE is owner or self-exit; PATCH
 *                                       canAddAdmin toggle is owner-only)
 */

import { adminDb } from "@/lib/firebase-admin"

export type PollAccessRole = "owner" | "member"

export type PollAccessResult =
  | {
      ok: true
      role: PollAccessRole
      ownerId: string
      pollSnap: FirebaseFirestore.DocumentSnapshot
      /** Only meaningful for role === "member" (owners can always add team
       *  members). True when the creator has granted this member the
       *  canAddAdmin privilege on their pollCollaborations doc. */
      canAddAdmin: boolean
      /** The member's own pollCollaborations doc id, when role === "member". */
      collaborationId: string | null
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
    return { ok: true, role: "owner", ownerId, pollSnap, canAddAdmin: true, collaborationId: null }
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

  const collabDoc = collabSnap.docs[0]

  return {
    ok: true,
    role: "member",
    ownerId: ownerId ?? "",
    pollSnap,
    canAddAdmin: collabDoc.data().canAddAdmin === true,
    collaborationId: collabDoc.id,
  }
}
