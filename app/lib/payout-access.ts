/**
 * app/lib/payout-access.ts
 *
 * Shared role-aware access resolution for the Payouts feature (spec §4
 * "Role Permissions"). Used by both /api/payout (viewing + initiating
 * payouts) and /api/payout/method (listing the correct payout methods).
 *
 *   Event Creator                → own payout methods, full view access
 *   Admin collaborator           → own payout methods, full view access
 *   Accountant                   → Creator's payout methods only, view access
 *   Custom role with "payout"    → Creator's payout methods only, view access
 *                                   permission
 *
 * Any other collaborator (e.g. checkin, or a custom role without the
 * "payout" permission) is forbidden.
 */

import { adminDb } from "@/lib/firebase-admin"

export type PayoutRole = "owner" | "admin" | "accountant" | "custom"

export type PayoutAccessResult =
  | {
      ok: true
      organizerId: string
      /** Whose payoutMethods collection to draw from */
      methodsOwnerId: string
      /** The caller's relationship to this event */
      role: PayoutRole
      eventSnap: FirebaseFirestore.DocumentSnapshot
    }
  | {
      ok: false
      error: string
      status: number
    }

export async function resolvePayoutAccess(
  eventId: string,
  userId: string
): Promise<PayoutAccessResult> {
  const eventRef = adminDb.collection("events").doc(eventId)
  const eventSnap = await eventRef.get()
  if (!eventSnap.exists) {
    return { ok: false, error: "Event not found", status: 404 }
  }

  const organizerId = eventSnap.data()!.organizerId as string
  if (organizerId === userId) {
    return { ok: true, organizerId, methodsOwnerId: userId, role: "owner", eventSnap }
  }

  const collabSnap = await adminDb
    .collection("collaborations")
    .where("eventId", "==", eventId)
    .where("collaboratorId", "==", userId)
    .where("isActive", "==", true)
    .get()

  if (collabSnap.empty) {
    return { ok: false, error: "Forbidden: you do not have payout access on this event", status: 403 }
  }

  const collab = collabSnap.docs[0].data()

  if (collab.role === "admin") {
    return { ok: true, organizerId, methodsOwnerId: userId, role: "admin", eventSnap }
  }

  if (collab.role === "accountant") {
    return { ok: true, organizerId, methodsOwnerId: organizerId, role: "accountant", eventSnap }
  }

  // Custom role — requires explicit "payout" permission, pays out to Creator only.
  if (Array.isArray(collab.permissions) && collab.permissions.includes("payout")) {
    return { ok: true, organizerId, methodsOwnerId: organizerId, role: "custom", eventSnap }
  }

  return { ok: false, error: "Forbidden: your role does not have payout permissions on this event", status: 403 }
}
