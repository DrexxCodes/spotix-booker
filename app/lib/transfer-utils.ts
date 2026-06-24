import { adminDb, FieldValue } from "@/lib/firebase-admin"

export const TRANSFER_TTL_MS = 3 * 24 * 60 * 60 * 1000 // 3 days
export const TRANSFER_TTL_DAYS = 3

/**
 * Normalizes a Firestore Timestamp / plain Date / ISO string / millis number
 * (or a serialized Firestore Timestamp shaped like { _seconds, _nanoseconds })
 * into epoch milliseconds. Returns null if it can't be parsed.
 */
export function toMillis(value: any): number | null {
  if (!value) return null

  // Firestore Admin Timestamp instance
  if (typeof value?.toMillis === "function") return value.toMillis()
  if (typeof value?.toDate === "function") return value.toDate().getTime()

  // Serialized Firestore Timestamp shape: { _seconds, _nanoseconds }
  if (typeof value === "object" && typeof value._seconds === "number") {
    return value._seconds * 1000 + Math.floor((value._nanoseconds ?? 0) / 1e6)
  }
  // Some callers may pass { seconds, nanoseconds } (e.g. firestore-rest)
  if (typeof value === "object" && typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1e6)
  }

  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed.getTime()
}

/** Whether a transfer's createdAt is older than the 3-day TTL. */
export function isTransferExpired(createdAt: any, now: number = Date.now()): boolean {
  const createdMs = toMillis(createdAt)
  if (createdMs === null) return false
  return now - createdMs > TRANSFER_TTL_MS
}

/** Whole days left before a transfer expires (never negative, rounds up). */
export function daysLeft(createdAt: any, now: number = Date.now()): number {
  const createdMs = toMillis(createdAt)
  if (createdMs === null) return 0
  const remainingMs = createdMs + TRANSFER_TTL_MS - now
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
}

/** Hours left before a transfer expires (never negative, rounds up). */
export function hoursLeft(createdAt: any, now: number = Date.now()): number {
  const createdMs = toMillis(createdAt)
  if (createdMs === null) return 0
  const remainingMs = createdMs + TRANSFER_TTL_MS - now
  return Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)))
}

/**
 * Marks a pending transfer as expired in both the canonical
 * transferRequests/{eventId}/requests/{transferId} doc and the denormalized
 * userTransferRequests/{recipientId}/requests/{transferId} mirror.
 * Safe to call even if already expired/actioned elsewhere (idempotent via batch).
 */
export async function expireTransfer(
  eventId: string,
  transferId: string,
  recipientId: string
): Promise<void> {
  const transferRef = adminDb
    .collection("transferRequests")
    .doc(eventId)
    .collection("requests")
    .doc(transferId)

  const userTransferRef = adminDb
    .collection("userTransferRequests")
    .doc(recipientId)
    .collection("requests")
    .doc(transferId)

  const batch = adminDb.batch()
  batch.update(transferRef, { status: "expired", expiredAt: FieldValue.serverTimestamp() })
  batch.update(userTransferRef, { status: "expired", expiredAt: FieldValue.serverTimestamp() })
  await batch.commit()
}
