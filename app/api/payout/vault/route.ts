/**
 * app/api/payout/vault/route.ts
 *
 * "The Vault" — multi-signature payout workflow.
 *
 * The Vault lets the Event Creator require multi-party sign-off before any
 * payout for this event clears. Once enabled it CANNOT be turned off again —
 * `enabledVault` only ever moves false → true. There is no disable action and
 * no way to remove a participant once added — both are permanent by design,
 * so the client must warn the Creator clearly before either call.
 *
 * GET  /api/payout/vault?eventId=xxx
 *   → Vault config for an event (enabledVault state, participant list — keys
 *     never returned). Callable by the owner or any active collaborator.
 *
 * POST /api/payout/vault
 *   Body: { eventId, action }
 *   action="enable"          — Event Creator only, one-time. Sets
 *                               enabledVault=true and automatically enrolls
 *                               the Creator as a Vault participant (they must
 *                               also set a Vault Key — see spec). Client must
 *                               show an irreversibility warning before calling.
 *   action="addParticipant"  — Creator only. Body also needs { collaboratorId }.
 *                               Only active "admin"-role collaborators may be
 *                               added, and only while enabledVault is true.
 *                               Permanent — cannot be undone. Client must show
 *                               a confirmation dialog before calling.
 *   action="setKey"          — Any assigned participant (Creator included)
 *                               sets/rotates their own Vault Key. Body also
 *                               needs { vaultKey }. Stored bcrypt-hashed
 *                               (one-way — never stored or returned in the clear).
 *
 * PATCH /api/payout/vault
 *   Body: { payoutId, vaultKey }
 *   → A Vault participant submits their key against a specific pending payout
 *     hold. Once every assigned participant has submitted, the payout is
 *     released from `vault_pending` into the normal `pending` payout queue.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { FieldValue } from "firebase-admin/firestore"
import { createInitializingPayout, getPayoutsForEvent } from "@/lib/payout-db"
import { writePayoutReferenceOnDateDoc } from "@/lib/payout-firestore"
import { triggerPayoutProcessing } from "@/lib/payout-backend"
import { requirePayoutAccessKey } from "@/lib/payout-access-gate"
import { DuplicateRequestError } from "@/lib/payout-idempotency"

const DEV_TAG = "spotix-api-v1"

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

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const gate = requirePayoutAccessKey(req)
  if (gate) return gate

  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get("eventId")
  if (!eventId?.trim()) return fail("eventId is required", 400)

  const eventSnap = await adminDb.collection("events").doc(eventId).get()
  if (!eventSnap.exists) return fail("Event not found", 404)
  const isOwner = eventSnap.data()!.organizerId === userId

  if (!isOwner) {
    const collabSnap = await adminDb
      .collection("collaborations")
      .where("eventId", "==", eventId)
      .where("collaboratorId", "==", userId)
      .where("isActive", "==", true)
      .get()
    if (collabSnap.empty) return fail("Forbidden", 403)
  }

  const vaultSnap = await adminDb.collection("vaults").doc(eventId).get()
  if (!vaultSnap.exists) {
    return ok({ vault: { eventId, enabledVault: false, participants: [] } })
  }

  const vault = vaultSnap.data()!
  return ok({
    vault: {
      eventId,
      enabledVault: vault.enabledVault === true,
      enabledAt: vault.enabledAt ?? null,
      participants: (vault.participants ?? []).map((p: any) => ({
        uid: p.uid,
        email: p.email,
        isCreator: p.isCreator === true,
        hasSetKey: Boolean(p.keyHash),
        addedAt: p.addedAt ?? null,
      })),
    },
  })
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const gate = requirePayoutAccessKey(req)
  if (gate) return gate

  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return fail("Invalid JSON body", 400)
  }

  const { eventId, action } = body
  if (!eventId?.trim()) return fail("eventId is required", 400)
  if (!action?.trim()) return fail("action is required", 400)

  const eventRef = adminDb.collection("events").doc(eventId)
  const eventSnap = await eventRef.get()
  if (!eventSnap.exists) return fail("Event not found", 404)
  const isOwner = eventSnap.data()!.organizerId === userId
  const vaultRef = adminDb.collection("vaults").doc(eventId)

  // ── enable ──────────────────────────────────────────────────────────────
  // One-way switch. Once set, enabledVault is never flipped back to false —
  // there is deliberately no "disable" action anywhere in this route.
  if (action === "enable") {
    if (!isOwner) return fail("Only the Event Creator can enable the Vault", 403)

    const existing = await vaultRef.get()
    if (existing.exists && existing.data()!.enabledVault === true) {
      return fail("The Vault is already enabled for this event", 409)
    }

    // The Creator is automatically enrolled as a Vault participant — the
    // spec requires the Creator to also set their own Vault Key, since they
    // are one of the parties who must sign off on every withdrawal.
    let creatorEmail = ""
    try {
      const creatorDoc = await adminDb.collection("users").doc(userId).get()
      creatorEmail = creatorDoc.data()?.email ?? ""
    } catch {
      // non-critical — email backfilled on next setKey/GET if lookup fails
    }

    const existingParticipants: any[] = existing.exists ? existing.data()!.participants ?? [] : []
    const participants = existingParticipants.some((p: any) => p.uid === userId)
      ? existingParticipants
      : [
          ...existingParticipants,
          {
            uid: userId,
            email: creatorEmail,
            isCreator: true,
            keyHash: null,
            addedAt: new Date().toISOString(),
          },
        ]

    await vaultRef.set(
      {
        eventId,
        enabledVault: true,
        enabledAt: FieldValue.serverTimestamp(),
        enabledBy: userId,
        participants,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return ok({
      message:
        "Vault enabled. This cannot be undone. Set your Vault Key, then choose which Admins should also be Vault participants.",
    })
  }

  // ── addParticipant ──────────────────────────────────────────────────────
  // Permanent — there is no removeParticipant action. Once an Admin is added
  // to the Vault, the Creator cannot take them back out.
  if (action === "addParticipant") {
    if (!isOwner) return fail("Only the Event Creator can add Vault participants", 403)

    const existingVault = await vaultRef.get()
    if (!existingVault.exists || existingVault.data()!.enabledVault !== true) {
      return fail("The Vault must be enabled before adding participants", 400)
    }

    const { collaboratorId } = body
    if (!collaboratorId?.trim()) return fail("collaboratorId is required", 400)

    const collabSnap = await adminDb
      .collection("collaborations")
      .where("eventId", "==", eventId)
      .where("collaboratorId", "==", collaboratorId)
      .where("isActive", "==", true)
      .get()
    const adminCollab = collabSnap.docs.find((d) => d.data().role === "admin")
    if (!adminCollab) return fail("collaboratorId must be an active Admin collaborator on this event", 400)

    const participants = existingVault.data()!.participants ?? []
    if (participants.some((p: any) => p.uid === collaboratorId)) {
      return fail("This participant is already in the Vault", 409)
    }

    participants.push({
      uid: collaboratorId,
      email: adminCollab.data().collaboratorEmail,
      isCreator: false,
      keyHash: null,
      addedAt: new Date().toISOString(),
    })

    await vaultRef.set({ eventId, participants, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    return ok({ message: "Participant permanently added to the Vault. They must set their Vault Key before payouts can clear." })
  }

  // ── setKey ──────────────────────────────────────────────────────────────
  if (action === "setKey") {
    const { vaultKey } = body
    if (!vaultKey || String(vaultKey).length < 6) {
      return fail("vaultKey must be at least 6 characters", 400)
    }

    const vaultSnap = await vaultRef.get()
    if (!vaultSnap.exists) return fail("Vault not configured for this event", 404)

    const participants = vaultSnap.data()!.participants ?? []
    const idx = participants.findIndex((p: any) => p.uid === userId)
    if (idx === -1) return fail("You are not a Vault participant on this event", 403)

    participants[idx] = {
      ...participants[idx],
      keyHash: await bcrypt.hash(String(vaultKey), 10),
      keySetAt: new Date().toISOString(),
    }

    await vaultRef.update({ participants, updatedAt: FieldValue.serverTimestamp() })
    return ok({ message: "Vault Key set." })
  }

  return fail(`Unknown action "${action}"`, 400)
}

// ── PATCH — submit a Vault Key against a pending payout hold ─────────────────
// Body: { holdId, vaultKey }  (holdId = a Firestore vaultHolds/{id})
//
// Once every assigned participant has submitted, this is the moment
// "the payout" actually begins: a Supabase `payouts` row is created
// (status "initializing"), its reference is stamped onto the Firestore
// date doc, and spotix-backend is asked to start processing it — all
// synchronously, right here, so the caller (whoever submitted the LAST
// key — the original requester or another participant) gets the fresh
// `reference` back and can open the live payout dialog immediately.
export async function PATCH(req: NextRequest) {
  const gate = requirePayoutAccessKey(req)
  if (gate) return gate

  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return fail("Invalid JSON body", 400)
  }

  const { holdId, vaultKey } = body
  if (!holdId?.trim()) return fail("holdId is required", 400)
  if (!vaultKey?.trim()) return fail("vaultKey is required", 400)

  const holdRef = adminDb.collection("vaultHolds").doc(holdId)
  const holdSnap = await holdRef.get()
  if (!holdSnap.exists) return fail("Payout hold not found", 404)
  const hold = holdSnap.data()!

  if (hold.status !== "vault_pending") {
    return fail(`This payout is not awaiting Vault sign-off (status: ${hold.status})`, 400)
  }

  const vaultSnap = await adminDb.collection("vaults").doc(hold.eventId).get()
  if (!vaultSnap.exists) return fail("Vault configuration not found for this event", 404)
  const participants: any[] = vaultSnap.data()!.participants ?? []

  const participant = participants.find((p) => p.uid === userId)
  if (!participant) return fail("You are not a Vault participant on this event", 403)
  if (!participant.keyHash) return fail("You have not set a Vault Key yet", 400)

  const matches = await bcrypt.compare(String(vaultKey), participant.keyHash)
  if (!matches) return fail("Incorrect Vault Key", 401)

  // ── Log: this participant just verified their Vault Key ────────────────────
  const submittedAt = new Date().toISOString()
  const signOffLog = {
    type: "vault_key_submitted",
    at: submittedAt,
    byUid: userId,
    byName: participant.isCreator ? "Event Creator" : "Admin",
    byEmail: participant.email ?? "",
    message: `${participant.email || "A Vault participant"} verified their Vault Key`,
  }

  const submissions: Record<string, boolean> = { ...(hold.vaultSubmissions ?? {}), [userId]: true }
  const submissionLog = { ...(hold.vaultSubmissionLog ?? {}), [userId]: submittedAt }
  const requiredUids: string[] = hold.vaultParticipants ?? participants.map((p) => p.uid)
  const allSubmitted = requiredUids.every((uid) => submissions[uid])

  if (!allSubmitted) {
    await holdRef.update({
      vaultSubmissions: submissions,
      vaultSubmissionLog: submissionLog,
      logs: FieldValue.arrayUnion(signOffLog),
    })
    return ok({
      message: "Vault Key accepted. Waiting on remaining participants.",
      released: false,
      remaining: requiredUids.filter((uid) => !submissions[uid]).length,
    })
  }

  // ── Every participant has signed off — release into a real payout ────────
  try {
    const row = await createInitializingPayout({
      isEvent: true,
      isPoll: false,
      eventId: hold.eventId,
      eventName: hold.eventName,
      payDate: hold.date,
      userId: hold.userId,
      amount: hold.amount,
      method: {
        methodId: hold.methodId,
        bankName: hold.bankName ?? "",
        bankCode: hold.bankCode ?? "",
        accountNumber: hold.accountNumber ?? "",
        accountName: hold.accountName ?? "",
        recipientCode: hold.recipientCode ?? null,
      },
      vaultLocked: true,
    })

    await writePayoutReferenceOnDateDoc({ eventId: hold.eventId }, hold.date, row.reference)
    triggerPayoutProcessing(row.reference)

    const releasedLog = {
      type: "vault_completed",
      at: new Date().toISOString(),
      message: `All Vault participants signed off — payout released for processing under reference ${row.reference}`,
    }

    await holdRef.update({
      vaultSubmissions: submissions,
      vaultSubmissionLog: submissionLog,
      status: "released",
      releasedReference: row.reference,
      vaultClearedAt: FieldValue.serverTimestamp(),
      logs: FieldValue.arrayUnion(signOffLog, releasedLog),
    })

    return ok({
      message: "All Vault Keys submitted. Payout released for processing.",
      released: true,
      reference: row.reference,
    })
  } catch (err: any) {
    // Two participants racing to submit the last required key can both
    // compute allSubmitted=true and both reach this block — the unique
    // index on (event_id, pay_date) in Supabase (see
    // /supabase/payout-schema.sql) means only ONE of those concurrent
    // createInitializingPayout() calls actually inserts a row; the other
    // gets DuplicateRequestError here. That's not a failure — the payout
    // WAS released (by the other caller), so this caller should see the
    // same success, not an error.
    if (err instanceof DuplicateRequestError) {
      await holdRef.update({
        vaultSubmissions: submissions,
        vaultSubmissionLog: submissionLog,
        logs: FieldValue.arrayUnion(signOffLog),
      })
      const rows = await getPayoutsForEvent(hold.eventId)
      const released = rows.find((r) => r.pay_date === hold.date && r.vault_locked)
      return ok({
        message: "All Vault Keys submitted. Payout released for processing.",
        released: true,
        reference: released?.reference ?? null,
      })
    }

    console.error("[PATCH /api/payout/vault] release error:", err)
    // The sign-off itself is still valid — record it even though the
    // release failed, so the participant isn't asked to re-enter their
    // key. Whoever's watching (or the next GET) will see status is still
    // "vault_pending" and can retry the release path.
    await holdRef.update({
      vaultSubmissions: submissions,
      vaultSubmissionLog: submissionLog,
      logs: FieldValue.arrayUnion(signOffLog),
    })
    return fail("All Vault Keys were verified, but releasing the payout failed. Please try again.", 500)
  }
}
