import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { FieldValue } from "firebase-admin/firestore"
import { resolvePayoutAccess } from "@/lib/payout-access"

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

function maskAccountNumber(accountNumber: string): string {
  const acc = String(accountNumber ?? "")
  if (acc.length <= 4) return acc
  return `${"•".repeat(acc.length - 4)}${acc.slice(-4)}`
}

async function getUserDisplay(uid: string): Promise<{ name: string; email: string }> {
  try {
    const doc = await adminDb.collection("users").doc(uid).get()
    const d = doc.data()
    return { name: d?.fullName || d?.email || "Unknown", email: d?.email || "" }
  } catch {
    return { name: "Unknown", email: "" }
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────
// ?eventId=xxx&action=list   → list daily transaction records
// ?eventId=xxx&action=status → list payouts matched per transaction date
export async function GET(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get("eventId")
  const action = searchParams.get("action") ?? "list"

  if (!eventId?.trim()) return fail("eventId is required", 400)

  // ── Role-aware access (spec §4 Role Permissions) ────────────────────────────
  // Creator, Admin, Accountant, and custom roles with the "payout" permission
  // may all VIEW the payout page — not just the event creator. Initiating a
  // withdrawal is further restricted in POST below.
  const access = await resolvePayoutAccess(eventId, userId)
  if (!access.ok) return fail(access.error, access.status)

  // ── action=list ────────────────────────────────────────────────────────────
  if (action === "list") {
    try {
      const snapshot = await adminDb
        .collection("admin")
        .doc("events")
        .collection(eventId)
        .get()

      if (snapshot.empty) return ok({ transactions: [] })

      const transactions = snapshot.docs
        .map((doc) => ({ date: doc.id, ...doc.data() }))
        .sort((a, b) => (a.date as string).localeCompare(b.date as string))

      return ok({ transactions })
    } catch (error: any) {
      console.error("[GET /api/payout?action=list] error:", error.code, error.message)
      return fail("Internal Server Error", 500)
    }
  }

  // ── action=status ──────────────────────────────────────────────────────────
  // Every role that clears resolvePayoutAccess sees every payout on the event
  // (any initiator) — this is a read-only records view. Only Creator/Admin can
  // actually initiate a payout (enforced in POST below), but Accountant and
  // custom "payout"-permission roles still need to see the full event history
  // since they can never have "their own" payouts to fall back on.
  if (action === "status") {
    try {
      const query = adminDb.collection("payouts").where("eventId", "==", eventId) as FirebaseFirestore.Query
      const payoutsSnap = await query.get()

      if (payoutsSnap.empty) return ok({ payouts: [] })

      const payouts = payoutsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Convert server timestamps to ISO strings for safe serialisation
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() ?? null,
        pendingAt: doc.data().pendingAt?.toDate?.()?.toISOString() ?? null,
        processingAt: doc.data().processingAt?.toDate?.()?.toISOString() ?? null,
        vaultClearedAt: doc.data().vaultClearedAt?.toDate?.()?.toISOString() ?? null,
        cancelledAt: doc.data().cancelledAt?.toDate?.()?.toISOString() ?? null,
      }))

      return ok({ payouts, scope: "event" })
    } catch (error: any) {
      console.error("[GET /api/payout?action=status] error:", error.code, error.message)
      return fail("Internal Server Error", 500)
    }
  }

  // ── action=vaultPending ─────────────────────────────────────────────────────
  // Every payout for this event currently held at status "vault_pending",
  // regardless of who initiated it. Needed so a Vault participant (Creator or
  // an assigned Admin) can find and sign off on holds they didn't personally
  // submit. Anyone with payout view access on the event can see this list —
  // signing still requires being an actual Vault participant (enforced in
  // PATCH /api/payout/vault).
  if (action === "vaultPending") {
    try {
      const snap = await adminDb
        .collection("payouts")
        .where("eventId", "==", eventId)
        .where("status", "==", "vault_pending")
        .get()

      const payouts = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
      }))

      return ok({ payouts })
    } catch (error: any) {
      console.error("[GET /api/payout?action=vaultPending] error:", error.code, error.message)
      return fail("Internal Server Error", 500)
    }
  }

  return fail("Invalid action. Use list, status, or vaultPending.", 400)
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return fail("Invalid JSON body", 400)
  }

  const { eventId, date, amount, methodId: requestedMethodId } = body
  if (!eventId?.trim()) return fail("eventId is required", 400)
  if (!date?.trim()) return fail("date is required", 400)
  if (amount === undefined || amount === null) return fail("amount is required", 400)
  if (typeof amount !== "number" || amount <= 0)
    return fail("amount must be a positive number", 400)

  // ── 1. Role-aware access (spec §4 Role Permissions) ─────────────────────────
  const access = await resolvePayoutAccess(eventId, userId)
  if (!access.ok) return fail(access.error, access.status)
  const { eventSnap, methodsOwnerId, role: initiatorRole } = access

  // ── 1.5. Role gate: only the Event Creator or an Admin may INITIATE a
  // payout. Accountant and custom roles with the "payout" permission passed
  // resolvePayoutAccess above so they can view this page and its records,
  // but they are read-only here — they cannot request/initiate a withdrawal
  // themselves, on their own behalf or anyone else's.
  if (initiatorRole !== "owner" && initiatorRole !== "admin") {
    return fail(
      "Forbidden: your role can view payout records but cannot initiate a payout. Only the Event Creator or an Admin can request a payout.",
      403
    )
  }

  // ── 2. Flagged event check ─────────────────────────────────────────────────
  if (eventSnap.data()!.flagged === true) {
    return fail(
      "Looks like we flagged your event. Please contact customer support with your eventId for more information.",
      403
    )
  }

  // ── 3. Global payout switch ────────────────────────────────────────────────
  const globalSnap = await adminDb.collection("admin").doc("global").get()
  if (globalSnap.exists) {
    const global = globalSnap.data()!
    if (global.isPayoutAllowed === false) {
      const reason = global.isPayoutNotAllowedReason
        ? ` Reason: ${global.isPayoutNotAllowedReason}`
        : ""
      return fail(`We are currently not processing payouts, check back later.${reason}`, 503)
    }
  }

  // ── 4. Transaction record exists ───────────────────────────────────────────
  const salesDocRef = adminDb
    .collection("admin")
    .doc("events")
    .collection(eventId)
    .doc(date)

  const salesDoc = await salesDocRef.get()
  if (!salesDoc.exists) return fail("Transaction date record not found", 404)
  const salesData = salesDoc.data()!

  // ── 5. 30-hour rule ────────────────────────────────────────────────────────
  const updatedAt = salesData.updatedAt
    ? new Date(salesData.updatedAt)
    : new Date(`${date}T00:00:00`)
  const diffHours = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60)

  if (diffHours < 30) {
    const remainingMs = updatedAt.getTime() + 30 * 60 * 60 * 1000 - Date.now()
    const h = Math.floor(remainingMs / (1000 * 60 * 60))
    const m = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
    return fail(
      `Withdrawal not yet available. Available in ${h}h ${m}m (30 hours after last purchase).`,
      403
    )
  }

  // ── 6. Restricted specific date check ─────────────────────────────────────
  // Firestore path: admin/global/restrictedDate/{yyyy-mm-dd}
  // Document field: isRestricted: true | false, reason?: string
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
  // Day names: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
  // Document field: isRestricted: true | false, reason?: string
  // Uses noon to avoid DST-related off-by-one on the day boundary
// AFTER
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
    // User explicitly selected a method — verify it belongs to methodsOwnerId
    // (their own methods for Creator/Admin, the Creator's methods for
    // Accountant/custom roles, per spec §4 Role Permissions).
    const specificSnap = await adminDb
      .collection("payoutMethods")
      .doc(methodsOwnerId)
      .collection("methods")
      .doc(requestedMethodId.trim())
      .get()
    if (specificSnap.exists) {
      methodDoc = specificSnap
    }
  }

  if (!methodDoc) {
    // Fall back to primary method
    const primarySnap = await adminDb
      .collection("payoutMethods")
      .doc(methodsOwnerId)
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

  const primaryMethod = methodDoc.data()!
  const methodId = methodDoc.id


  // ── 9. Duplicate guard ────────────────────────────────────────────────────
  // Cancelled or rejected payouts don't block a fresh request for the same
  // date — that's the whole point of allowing a stop/reject in the first
  // place: the slot opens back up for a new attempt.
  const existingPayout = await adminDb
    .collection("payouts")
    .where("eventId", "==", eventId)
    .where("date", "==", date)
    .where("userId", "==", userId)
    .get()

  if (existingPayout.docs.some((d) => !["cancelled", "rejected"].includes(d.data().status))) {
    return fail("A payout request for this date has already been submitted.", 409)
  }


  // ── 10. Fetch event name from admin/events/{eventId}/{date} ───────────────
  let eventName = ""
  try {
    const eventDocRef = adminDb
      .collection("admin")
      .doc("events")
      .collection(eventId)
      .doc(date)
    const eventDocSnap = await eventDocRef.get()
    if (eventDocSnap.exists) {
      eventName = eventDocSnap.data()?.eventName ?? ""
    }
  } catch (err) {
    console.warn("[POST /api/payout] failed to fetch eventName:", err)
    // Non-critical — proceed without eventName
  }

  // ── 10.5. The Vault — multi-signature hold ──────────────────────────────────
  // See app/api/payout/vault/route.ts. If enabled, the request is created as a
  // held payout that only clears once every assigned participant submits their
  // Vault Key (PATCH /api/payout/vault).
  const vaultSnap = await adminDb.collection("vaults").doc(eventId).get()
  const vaultEnabled = vaultSnap.exists && vaultSnap.data()!.enabledVault === true
  const vaultParticipantRecords: any[] = vaultEnabled ? (vaultSnap.data()!.participants ?? []) : []
  const vaultParticipants: string[] = vaultParticipantRecords.map((p: any) => p.uid)

  if (vaultEnabled && vaultParticipants.length === 0) {
    return fail("The Vault is enabled but has no participants assigned yet. Ask the Event Creator to add at least one Admin.", 409)
  }

  // Every assigned Vault participant (Creator included) must have their Vault
  // Key set up before ANY payout for this event — for any day — can be
  // requested. Otherwise a payout could get stuck at "vault_pending" forever
  // waiting on a key that was never set.
  if (vaultEnabled) {
    const withoutKey = vaultParticipantRecords.filter((p: any) => !p.keyHash)
    if (withoutKey.length > 0) {
      const pending = withoutKey.map((p: any) => p.email || p.uid).join(", ")
      return fail(
        `The Vault is enabled but ${withoutKey.length} participant(s) haven't set their Vault Key yet (${pending}). Every Vault participant must set their key before a payout can be requested.`,
        409
      )
    }
  }

  const initiator = await getUserDisplay(userId)
  const roleLabel =
    initiatorRole === "owner" ? "Event Creator" : initiatorRole === "admin" ? "Admin" : initiatorRole === "accountant" ? "Accountant" : "Team member"

  // NOTE for spotix-api (the Fastify transfer/webhook service): once a payout
  // moves to "processing" (Paystack transfer initiated) or resolves to
  // "successful"/"failed" via the transfer webhook, append a matching entry
  // to this same `logs` array using FieldValue.arrayUnion so it shows up in
  // the "Logs" timeline here, e.g.:
  //   { type: "processing", at: <iso>, message: "Transfer initiated with Paystack" }
  //   { type: "successful", at: <iso>, message: "Transfer completed successfully" }
  //   { type: "failed", at: <iso>, message: "<reason from Paystack>" }
  try {
    const initiatedLog = {
      type: "initiated",
      at: new Date().toISOString(),
      byUid: userId,
      byName: initiator.name,
      byEmail: initiator.email,
      message: vaultEnabled
        ? `Payout requested by ${initiator.name} (${roleLabel}) — awaiting Vault sign-off`
        : `Payout requested by ${initiator.name} (${roleLabel})`,
      meta: {
        maskedAccountNumber: maskAccountNumber(primaryMethod.accountNumber ?? ""),
        bankName: primaryMethod.bankName ?? "",
      },
    }

    const basePayout = {
      eventId,
      userId,
      date,
      amount,
      eventName,
      methodId,
      bankName: primaryMethod.bankName ?? "",
      bankCode: primaryMethod.bankCode ?? "",
      accountNumber: primaryMethod.accountNumber ?? "",
      accountName: primaryMethod.accountName ?? "",
      recipientCode: primaryMethod.recipientCode ?? null,
      initiatedByName: initiator.name,
      initiatedByEmail: initiator.email,
      createdAt: FieldValue.serverTimestamp(),
      logs: [initiatedLog],
    }

    const payoutRef = await adminDb.collection("payouts").add(
      vaultEnabled
        ? {
            ...basePayout,
            status: "vault_pending",
            vaultParticipants,
            vaultSubmissions: {},
          }
        : {
            ...basePayout,
            status: "pending",
            pendingAt: FieldValue.serverTimestamp(),
          }
    )

    return ok({
      message: vaultEnabled
        ? `Payout request submitted and is awaiting sign-off from ${vaultParticipants.length} Vault participant(s).`
        : "Payout request submitted successfully",
      payoutId: payoutRef.id,
      vaultLocked: vaultEnabled,
    })
  } catch (err: any) {
    console.error("[POST /api/payout] write error:", err)
    return fail("Failed to submit payout request", 500)
  }
}


export async function PATCH(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return fail("Invalid JSON body", 400)
  }

  const { payoutId } = body
  if (!payoutId?.trim()) return fail("payoutId is required", 400)

  try {
    const payoutRef = adminDb.collection("payouts").doc(payoutId)
    const payoutSnap = await payoutRef.get()

    if (!payoutSnap.exists) return fail("Payout record not found", 404)

    const payout = payoutSnap.data()!

    // Only the owner can re-run their payout
    if (payout.userId !== userId) return fail("Forbidden", 403)

    // Only failed payouts can be re-run
    if (payout.status !== "failed") {
      return fail(`Cannot re-run a payout with status: ${payout.status}`, 400)
    }

    await payoutRef.update({
      status: "pending",
      updatedAt: FieldValue.serverTimestamp(),
      pendingAt: FieldValue.serverTimestamp(),
    })

    return ok({ message: "Payout re-queued successfully" })
  } catch (err: any) {
    console.error("[PATCH /api/payout] error:", err)
    return fail("Failed to re-run payout", 500)
  }
}

export async function PUT() {
  return fail("Method Not Allowed", 405)
}

// ── DELETE — stop (cancel) or reject an active payout ────────────────────────
// "Deleting" here is a soft-cancel/reject: the payout doc is never actually
// removed from Firestore, since the whole point is that the action itself
// must still show up in that payout's log timeline.
//
// Who does what:
//   - The person who INITIATED the payout can CANCEL it (status → "cancelled").
//   - Any OTHER Event Creator/Admin (i.e. someone who did not initiate this
//     specific payout) can REJECT it instead (status → "rejected"). A reject
//     is terminal: it permanently kills that payout — no one can act on it
//     again, and (per the vault_pending guard in PATCH /api/payout/vault) no
//     remaining Vault participant can submit their key against it once
//     rejected, exactly like once cancelled.
// Only the Event Creator or an Admin collaborator can do either — Accountant
// and custom-role viewers cannot cancel or reject (their own or anyone
// else's), they are read-only on this feature.
export async function DELETE(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return fail("Invalid JSON body", 400)
  }

  const { payoutId } = body
  if (!payoutId?.trim()) return fail("payoutId is required", 400)

  try {
    const payoutRef = adminDb.collection("payouts").doc(payoutId)
    const payoutSnap = await payoutRef.get()
    if (!payoutSnap.exists) return fail("Payout record not found", 404)
    const payout = payoutSnap.data()!

    const access = await resolvePayoutAccess(payout.eventId, userId)
    if (!access.ok) return fail(access.error, access.status)
    if (access.role !== "owner" && access.role !== "admin") {
      return fail("Only the Event Creator or an Admin can cancel or reject a payout", 403)
    }

    const actionableStatuses = ["pending", "processing", "vault_pending"]
    if (!actionableStatuses.includes(payout.status)) {
      return fail(`Cannot act on a payout with status: ${payout.status}`, 400)
    }

    // The requester (payout.userId) can only ever be the Event Creator or an
    // Admin (see the initiator gate in POST above) — so this comparison alone
    // is enough to tell a self-cancel from a reject by someone else.
    const isInitiator = payout.userId === userId
    const finalStatus = isInitiator ? "cancelled" : "rejected"
    const roleLabel = access.role === "owner" ? "Event Creator" : "Admin"

    const actor = await getUserDisplay(userId)
    const actionLog = isInitiator
      ? {
          type: "cancelled",
          at: new Date().toISOString(),
          byUid: userId,
          byName: actor.name,
          byEmail: actor.email,
          message: `Payout stopped by ${actor.name} (${roleLabel}) while status was "${payout.status}"`,
        }
      : {
          type: "rejected",
          at: new Date().toISOString(),
          byUid: userId,
          byName: actor.name,
          byEmail: actor.email,
          message: `Payout rejected by ${actor.name} (${roleLabel}) while status was "${payout.status}" — this payout can no longer proceed`,
        }

    await payoutRef.update({
      status: finalStatus,
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: userId,
      cancelledByName: actor.name,
      logs: FieldValue.arrayUnion(actionLog),
    })

    return ok({
      message: isInitiator
        ? "Payout cancelled. It remains visible in the logs."
        : "Payout rejected. It can no longer proceed and remains visible in the logs.",
      status: finalStatus,
    })
  } catch (err: any) {
    console.error("[DELETE /api/payout] error:", err)
    return fail("Failed to cancel/reject payout", 500)
  }
}
