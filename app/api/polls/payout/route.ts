/**
 * app/api/polls/payout/route.ts
 *
 * GET  /api/polls/payout?pollId=xxx&action=list    — per-day vote transactions
 * GET  /api/polls/payout?pollId=xxx&action=status   — payout request history
 * POST /api/polls/payout     — request a payout for one transaction date
 * PATCH /api/polls/payout    — re-queue a failed payout
 *
 * Uses the FLAT voting/{pollId} collection for ownership/flag checks, and the
 * per-day admin/votes/{pollId}/{date} aggregation (written by backend/v1/voting.js)
 * as the source of truth for payout amounts and eligibility — mirroring the
 * admin/events/{eventId}/{date} pattern used by /api/payout for events.
 *
 * Payout gates (matching /api/payout event pattern):
 *   1. Poll flagged === true → payouts disabled
 *   2. Poll suspended === true → payouts disabled
 *   3. Global payout switch (admin/global.isPayoutAllowed)
 *   4. Transaction date record must exist (admin/votes/{pollId}/{date})
 *   5. 30-hour hold since that day's lastUpdated
 *   6. Restricted specific date (admin/global/restrictedDate/{date})
 *   7. Restricted day-of-week (admin/global/restrictedDays/{DayName})
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { FieldValue } from "firebase-admin/firestore"

const DEV_TAG = "spotix-api-v1"
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function ok(data: object, status = 200) {
  return NextResponse.json({ success: true, developer: DEV_TAG, ...data }, { status })
}
function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message, developer: DEV_TAG }, { status })
}

async function authenticate(): Promise<{ userId: string } | NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get("spotix_at")?.value
  if (!token) return fail("No access token", 401)
  try {
    const payload = await verifyAccessToken(token, "spotix-booker")
    return { userId: payload.uid }
  } catch {
    return fail("Invalid or expired access token", 401)
  }
}

async function resolveOwnedPoll(
  pollId: string,
  userId: string,
): Promise<
  | { snap: FirebaseFirestore.DocumentSnapshot; ref: FirebaseFirestore.DocumentReference }
  | NextResponse
> {
  const ref  = adminDb.collection("voting").doc(pollId)
  const snap = await ref.get()
  if (!snap.exists) return fail("Poll not found", 404)
  const d     = snap.data()!
  const owner = d.creatorId ?? d.organizerId ?? null
  if (owner !== userId) return fail("You do not own this poll", 403)
  return { snap, ref }
}

// ─── GET ──────────────────────────────────────────────────────────────────────
// ?pollId=xxx&action=list   → list daily vote transaction records
// ?pollId=xxx&action=status → list payouts matched per transaction date
export async function GET(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const pollId = searchParams.get("pollId")
  const action = searchParams.get("action") ?? "status"

  if (!pollId?.trim()) return fail("pollId is required", 400)

  const owned = await resolveOwnedPoll(pollId, userId)
  if (owned instanceof NextResponse) return owned

  // ── action=list ────────────────────────────────────────────────────────────
  if (action === "list") {
    try {
      const snapshot = await adminDb
        .collection("admin")
        .doc("votes")
        .collection(pollId)
        .get()

      if (snapshot.empty) return ok({ transactions: [] })

      const transactions = snapshot.docs
        .map((doc) => ({ date: doc.id, ...doc.data() }))
        .sort((a, b) => (a.date as string).localeCompare(b.date as string))

      return ok({ transactions })
    } catch (error: any) {
      console.error("[GET /api/polls/payout?action=list] error:", error.code, error.message)
      return fail("Internal Server Error", 500)
    }
  }

  // ── action=status ──────────────────────────────────────────────────────────
  if (action === "status") {
    try {
      const snap = await adminDb
        .collection("payouts")
        .where("pollId", "==", pollId)
        .where("userId", "==", userId)
        .get()

      if (snap.empty) return ok({ payouts: [] })

      const payouts = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() ?? null,
        pendingAt: doc.data().pendingAt?.toDate?.()?.toISOString() ?? null,
        processingAt: doc.data().processingAt?.toDate?.()?.toISOString() ?? null,
      }))

      return ok({ payouts })
    } catch (err: any) {
      console.error("[GET /api/polls/payout?action=status] error:", err)
      return fail("Internal Server Error", 500)
    }
  }

  return fail("Invalid action. Use list or status.", 400)
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try { body = await req.json() }
  catch { return fail("Invalid JSON body", 400) }

  const { pollId, date, amount, methodId: requestedMethodId } = body

  if (!pollId?.trim())                           return fail("pollId is required", 400)
  if (!date?.trim())                             return fail("date is required", 400)
  if (amount === undefined || amount === null)   return fail("amount is required", 400)
  if (typeof amount !== "number" || amount <= 0) return fail("amount must be a positive number", 400)

  // ── Ownership ──────────────────────────────────────────────────────────────
  const owned = await resolveOwnedPoll(pollId, userId)
  if (owned instanceof NextResponse) return owned
  const { snap: pollSnap } = owned
  const pollData = pollSnap.data()!

  // ── 1. Flagged check ───────────────────────────────────────────────────────
  if (pollData.flagged === true) {
    return fail(
      "This poll has been flagged by Spotix. Payouts are disabled. Please contact customer support with your poll ID for more information.",
      403,
    )
  }

  // ── 2. Suspended check ─────────────────────────────────────────────────────
  if (pollData.suspended === true) {
    return fail(
      "This poll has been suspended by Spotix. Payouts are currently disabled. Please contact support.",
      403,
    )
  }

  // ── 3. Global payout switch ────────────────────────────────────────────────
  const globalSnap = await adminDb.collection("admin").doc("global").get()
  if (globalSnap.exists) {
    const g = globalSnap.data()!
    if (g.isPayoutAllowed === false) {
      const reason = g.isPayoutNotAllowedReason ? ` Reason: ${g.isPayoutNotAllowedReason}` : ""
      return fail(`Payouts are currently paused.${reason}`, 503)
    }
  }

  // ── 4. Transaction record exists ───────────────────────────────────────────
  const salesDocRef = adminDb
    .collection("admin")
    .doc("votes")
    .collection(pollId)
    .doc(date)

  const salesDoc = await salesDocRef.get()
  if (!salesDoc.exists) return fail("Transaction date record not found", 404)
  const salesData = salesDoc.data()!

  // ── 5. 30-hour rule ────────────────────────────────────────────────────────
  const updatedAt = salesData.lastUpdated
    ? new Date(salesData.lastUpdated)
    : new Date(`${date}T00:00:00`)
  const diffHours = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60)

  if (diffHours < 30) {
    const remainingMs = updatedAt.getTime() + 30 * 60 * 60 * 1000 - Date.now()
    const h = Math.floor(remainingMs / (1000 * 60 * 60))
    const m = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
    return fail(
      `Withdrawal not yet available. Available in ${h}h ${m}m (30 hours after last vote).`,
      403
    )
  }

  // ── 6. Restricted specific date check ─────────────────────────────────────
  // Firestore path: admin/global/restrictedDate/{yyyy-mm-dd}
  const restrictedDateSnap = await adminDb
    .collection("admin")
    .doc("global")
    .collection("restrictedDate")
    .doc(date)
    .get()

  if (restrictedDateSnap.exists && restrictedDateSnap.data()!.isRestricted === true) {
    const reason =
      restrictedDateSnap.data()!.reason ??
      `Payouts for ${date} are currently restricted. Please try again later.`
    return fail(reason, 403)
  }

  // ── 7. Restricted day-of-week check ───────────────────────────────────────
  // Firestore path: admin/global/restrictedDays/{DayName}
  // Uses noon to avoid DST-related off-by-one on the day boundary
  const txnDayOfWeek = DAYS[new Date(`${date}T12:00:00`).getDay()]
  const todayDayOfWeek = DAYS[new Date().getDay()]

  if (txnDayOfWeek === todayDayOfWeek) {
    const restrictedDaySnap = await adminDb
      .collection("admin")
      .doc("global")
      .collection("restrictedDays")
      .doc(txnDayOfWeek)
      .get()

    if (restrictedDaySnap.exists && restrictedDaySnap.data()!.isRestricted === true) {
      const reason =
        restrictedDaySnap.data()!.reason ??
        `Payouts for transactions on ${txnDayOfWeek}s are currently restricted. Please try again later.`
      return fail(reason, 403)
    }
  }

  // ── 8. Payout method — use user-selected method if provided, else primary ──
  let methodDoc: FirebaseFirestore.DocumentSnapshot | null = null

  if (requestedMethodId?.trim()) {
    const specificSnap = await adminDb
      .collection("payoutMethods")
      .doc(userId)
      .collection("methods")
      .doc(requestedMethodId.trim())
      .get()
    if (specificSnap.exists) {
      methodDoc = specificSnap
    }
  }

  if (!methodDoc) {
    const primarySnap = await adminDb
      .collection("payoutMethods")
      .doc(userId)
      .collection("methods")
      .where("primary", "==", true)
      .limit(1)
      .get()
    if (!primarySnap.empty) {
      methodDoc = primarySnap.docs[0]
    }
  }

  if (!methodDoc) {
    return fail("No payout method found. Please add a bank account first.", 400)
  }

  const method   = methodDoc.data()!
  const methodId = methodDoc.id

  // ── 9. Duplicate guard ────────────────────────────────────────────────────
  const existingPayout = await adminDb
    .collection("payouts")
    .where("pollId", "==", pollId)
    .where("date", "==", date)
    .where("userId", "==", userId)
    .limit(1)
    .get()

  if (!existingPayout.empty) {
    return fail("A payout request for this date has already been submitted.", 409)
  }

  // ── 10. Write payout ───────────────────────────────────────────────────────
  try {
    const payoutRef = await adminDb.collection("payouts").add({
      pollId,
      pollName:       pollData.pollName ?? salesData.pollName ?? "",
      pollType:       pollData.pollType ?? "single",
      userId,
      date,
      amount,
      type: "poll_payout",

      // Royalty info (for reference/audit — net amount is already what's stored)
      buyerBearsBurden: pollData.buyerBearsBurden ?? true,

      methodId,
      bankName:       method.bankName      ?? "",
      bankCode:       method.bankCode      ?? "",
      accountNumber:  method.accountNumber ?? "",
      accountName:    method.accountName   ?? "",
      recipientCode:  method.recipientCode ?? null,

      status:    "pending",
      createdAt: FieldValue.serverTimestamp(),
      pendingAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return ok({ message: "Payout request submitted successfully", payoutId: payoutRef.id })
  } catch (err: any) {
    console.error("[POST /api/polls/payout] write error:", err)
    return fail("Failed to submit payout request", 500)
  }
}

// ─── PATCH — re-queue failed payout ──────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try { body = await req.json() }
  catch { return fail("Invalid JSON body", 400) }

  const { payoutId } = body
  if (!payoutId?.trim()) return fail("payoutId is required", 400)

  try {
    const ref  = adminDb.collection("payouts").doc(payoutId)
    const snap = await ref.get()

    if (!snap.exists)          return fail("Payout record not found", 404)
    const p = snap.data()!
    if (p.userId !== userId)   return fail("Forbidden", 403)
    if (p.status !== "failed") return fail(`Cannot re-queue a payout with status: ${p.status}`, 400)

    await ref.update({
      status:    "pending",
      updatedAt: FieldValue.serverTimestamp(),
      pendingAt: FieldValue.serverTimestamp(),
    })

    return ok({ message: "Payout re-queued successfully" })
  } catch (err: any) {
    console.error("[PATCH /api/polls/payout] error:", err)
    return fail("Failed to re-queue payout", 500)
  }
}

export async function PUT()    { return fail("Method Not Allowed", 405) }
export async function DELETE() { return fail("Method Not Allowed", 405) }
