/**
 * app/lib/otta.ts
 *
 * OTTA = Overhead Timed Transfer Authorization.
 *
 * This is spotix-booker's read/verify side of the same `ottaKeys`
 * Firestore collection spotix-admin's app/lib/otta.ts generates keys
 * into (see that file for the full doc shape and design rationale).
 * Booker never GENERATES an OTTA key — only admins do, from the
 * Transfers menu — but a Vault participant's key can be entered here to
 * sign off on a Vault payout hold on that participant's behalf (see
 * app/api/payout/vault/route.ts PATCH).
 */

import { adminDb } from "@/lib/firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import bcrypt from "bcryptjs"

export interface OttaVerifyResult {
  ok: boolean
  error?: string
  keyId?: string
  ownerUid?: string
  ownerName?: string
}

/**
 * Verifies a plain OTTA key against every still-live candidate and checks
 * it covers `amount`. Marks it used (consumed) on success — an OTTA key
 * is single-use across BOTH apps, since they share the same collection.
 */
export async function verifyAndConsumeOtta(
  plainKey: string,
  amount: number,
  usedFor: { type: "transfer" | "vault"; id: string },
): Promise<OttaVerifyResult> {
  const trimmed = String(plainKey ?? "").trim().toUpperCase()
  if (!trimmed) return { ok: false, error: "OTTA key is required" }

  const now = Timestamp.now()
  const candidatesSnap = await adminDb
    .collection("ottaKeys")
    .where("used", "==", false)
    .where("revoked", "==", false)
    .get()

  for (const doc of candidatesSnap.docs) {
    const d = doc.data()
    const matches = await bcrypt.compare(trimmed, d.keyHash)
    if (!matches) continue

    if (d.expiresAt && d.expiresAt.toMillis() < now.toMillis()) {
      return { ok: false, error: "This OTTA key has expired" }
    }
    if (typeof d.maxAmount === "number" && amount > d.maxAmount) {
      return { ok: false, error: "This OTTA key can't validate this amount" }
    }

    await doc.ref.update({
      used: true,
      usedAt: new Date(),
      usedForType: usedFor.type,
      usedForId: usedFor.id,
    })

    return { ok: true, keyId: doc.id, ownerUid: d.ownerUid, ownerName: d.ownerName }
  }

  return { ok: false, error: "Invalid OTTA key" }
}
