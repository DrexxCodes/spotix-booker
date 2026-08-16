/**
 * app/api/polls/payout/route.ts
 *
 * GET  /api/polls/payout?pollId=xxx&action=list    — per-day vote transactions
 * GET  /api/polls/payout?pollId=xxx&action=status   — payout history (Supabase)
 * POST /api/polls/payout     — request a payout for one transaction date
 *
 * GET is readable by the poll creator OR any active poll team member.
 * POST (actually moving money) stays creator-only, exactly as before.
 *
 * Polls have no Vault feature — a payout begins immediately once every
 * check below passes, same as the non-Vault path for events.
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
import { resolvePollAccess } from "@/lib/poll-team-access"
import { createInitializingPayout, getPayoutsForPoll, hasActiveOrSuccessfulPayout } from "@/lib/payout-db"
import { writePayoutReferenceOnDateDoc } from "@/lib/payout-firestore"
import { triggerPayoutProcessing } from "@/lib/payout-backend"
import { requirePayoutAccessKey } from "@/lib/payout-access-gate"
import { claimIdempotencyKey, DuplicateRequestError } from "@/lib/payout-idempotency"

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
  if (owner !== userId) return fail("Only the poll creator can initiate or manage payouts", 403)
  return { snap, ref }
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const gate = requirePayoutAccessKey(req)
  if (gate) return gate

  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const pollId = searchParams.get("pollId")
  const action = searchParams.get("action") ?? "status"

  if (!pollId?.trim()) return fail("pollId is required", 400)

  const access = await resolvePollAccess(pollId, userId)
  if (!access.ok) return fail(access.error, access.status)

  if (action === "list") {
    try {
      const snapshot = await adminDb.collection("admin").doc("votes").collection(pollId).get()
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

  if (action === "status") {
    try {
      const rows = await getPayoutsForPoll(pollId)
      const payouts = rows.map((r) => ({
        id: r.reference,
        reference: r.reference,
        pollId: r.poll_id,
        userId: r.user_id,
        date: r.pay_date,
        amount: r.amount,
        bankName: r.bank_name,
        bankCode: r.bank_code,
        accountNumber: r.account_number,
        accountName: r.account_name,
        status: r.status,
        failureReason: r.failure_reason,
        narration: r.narration,
        durationSeconds: r.duration_seconds,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
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
  const gate = requirePayoutAccessKey(req)
  if (gate) return gate

  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const idempotencyKey = req.headers.get("idempotency-key")
  if (!idempotencyKey?.trim()) return fail("Idempotency-Key header is required", 400)
  try {
    await claimIdempotencyKey(idempotencyKey, userId)
  } catch (err) {
    if (err instanceof DuplicateRequestError) return fail(err.message, 409)
    return fail("Could not verify request uniqueness. Please try again.", 500)
  }

  let body: Record<string, any>
  try { body = await req.json() }
  catch { return fail("Invalid JSON body", 400) }

  const { pollId, date, amount, methodId: requestedMethodId } = body

  if (!pollId?.trim())                           return fail("pollId is required", 400)
  if (!date?.trim())                             return fail("date is required", 400)
  if (amount === undefined || amount === null)   return fail("amount is required", 400)
  if (typeof amount !== "number" || amount <= 0) return fail("amount must be a positive number", 400)

  const owned = await resolveOwnedPoll(pollId, userId)
  if (owned instanceof NextResponse) return owned
  const { snap: pollSnap } = owned
  const pollData = pollSnap.data()!

  if (pollData.flagged === true) {
    return fail(
      "This poll has been flagged by Spotix. Payouts are disabled. Please contact customer support with your poll ID for more information.",
      403,
    )
  }
  if (pollData.suspended === true) {
    return fail("This poll has been suspended by Spotix. Payouts are currently disabled. Please contact support.", 403)
  }

  const globalSnap = await adminDb.collection("admin").doc("global").get()
  if (globalSnap.exists) {
    const g = globalSnap.data()!
    if (g.isPayoutAllowed === false) {
      const reason = g.isPayoutNotAllowedReason ? ` Reason: ${g.isPayoutNotAllowedReason}` : ""
      return fail(`Payouts are currently paused.${reason}`, 503)
    }
  }

  const salesDocRef = adminDb.collection("admin").doc("votes").collection(pollId).doc(date)
  const salesDoc = await salesDocRef.get()
  if (!salesDoc.exists) return fail("Transaction date record not found", 404)
  const salesData = salesDoc.data()!

  const updatedAt = salesData.lastUpdated ? new Date(salesData.lastUpdated) : new Date(`${date}T00:00:00`)
  const diffHours = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60)
  if (diffHours < 30) {
    const remainingMs = updatedAt.getTime() + 30 * 60 * 60 * 1000 - Date.now()
    const h = Math.floor(remainingMs / (1000 * 60 * 60))
    const m = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
    return fail(`Withdrawal not yet available. Available in ${h}h ${m}m (30 hours after last vote).`, 403)
  }

  const restrictedDateSnap = await adminDb.collection("admin").doc("global").collection("restrictedDate").doc(date).get()
  if (restrictedDateSnap.exists && restrictedDateSnap.data()!.isRestricted === true) {
    const reason = restrictedDateSnap.data()!.reason ?? `Payouts for ${date} are currently restricted. Please try again later.`
    return fail(reason, 403)
  }

  const txnDayOfWeek = DAYS[new Date(`${date}T12:00:00`).getDay()]
  const todayDayOfWeek = DAYS[new Date().getDay()]
  if (txnDayOfWeek === todayDayOfWeek) {
    const restrictedDaySnap = await adminDb.collection("admin").doc("global").collection("restrictedDays").doc(txnDayOfWeek).get()
    if (restrictedDaySnap.exists && restrictedDaySnap.data()!.isRestricted === true) {
      const reason =
        restrictedDaySnap.data()!.reason ?? `Payouts for transactions on ${txnDayOfWeek}s are currently restricted. Please try again later.`
      return fail(reason, 403)
    }
  }

  let methodDoc: FirebaseFirestore.DocumentSnapshot | null = null
  if (requestedMethodId?.trim()) {
    const specificSnap = await adminDb.collection("payoutMethods").doc(userId).collection("methods").doc(requestedMethodId.trim()).get()
    if (specificSnap.exists) methodDoc = specificSnap
  }
  if (!methodDoc) {
    const primarySnap = await adminDb.collection("payoutMethods").doc(userId).collection("methods").where("primary", "==", true).limit(1).get()
    if (!primarySnap.empty) methodDoc = primarySnap.docs[0]
  }
  if (!methodDoc) return fail("No payout method found. Please add a bank account first.", 400)

  const method   = methodDoc.data()!
  const methodId = methodDoc.id

  const alreadyActive = await hasActiveOrSuccessfulPayout({ pollId }, date)
  if (alreadyActive) return fail("A payout request for this date has already been submitted.", 409)

  try {
    const pollName = pollData.pollName ?? salesData.pollName ?? ""
    const row = await createInitializingPayout({
      isEvent: false,
      isPoll: true,
      pollId,
      pollName,
      payDate: date,
      userId,
      amount,
      method: {
        methodId,
        bankName: method.bankName ?? "",
        bankCode: method.bankCode ?? "",
        accountNumber: method.accountNumber ?? "",
        accountName: method.accountName ?? "",
        recipientCode: method.recipientCode ?? null,
      },
      vaultLocked: false,
    })

    await writePayoutReferenceOnDateDoc({ pollId }, date, row.reference)
    triggerPayoutProcessing(row.reference)

    return ok({ message: "Payout request submitted successfully", reference: row.reference })
  } catch (err: any) {
    if (err instanceof DuplicateRequestError) return fail(err.message, 409)
    console.error("[POST /api/polls/payout] write error:", err)
    return fail("Failed to submit payout request", 500)
  }
}

export async function PATCH(req: NextRequest) {
  const gate = requirePayoutAccessKey(req)
  if (gate) return gate
  return fail("Failed payouts cannot be retried. Please contact Spotix support with your payout reference.", 405)
}
export async function PUT(req: NextRequest)    { const gate = requirePayoutAccessKey(req); if (gate) return gate; return fail("Method Not Allowed", 405) }
export async function DELETE(req: NextRequest) { const gate = requirePayoutAccessKey(req); if (gate) return gate; return fail("Method Not Allowed", 405) }
