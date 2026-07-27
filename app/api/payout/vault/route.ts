/**
 * app/api/payout/vault/route.ts
 *
 * "The Vault" — multi-signature payout workflow (spec §4).
 *
 * GET  /api/payout/vault?eventId=xxx
 *   → Vault config for an event (enabled state, participant list — keys never
 *     returned). Callable by the owner or any active collaborator on the event.
 *
 * POST /api/payout/vault
 *   Body: { eventId, action }
 *   action="enable"          — Event Creator only. Irreversible via this action;
 *                               client must show a confirmation dialog before calling.
 *   action="addParticipant"  — Creator only. Body also needs { collaboratorId }.
 *                               Only active "admin"-role collaborators may be added.
 *   action="removeParticipant" — Creator only. Body also needs { collaboratorId }.
 *   action="setKey"          — Any assigned participant sets/rotates their own
 *                               Vault Key. Body also needs { vaultKey }. Stored
 *                               bcrypt-hashed, never returned.
 *   action="disable"         — Admin collaborator only (spec: "Deactivation
 *                               requires an Admin").
 *
 * PATCH /api/payout/vault
 *   Body: { payoutId, vaultKey }
 *   → A Vault participant submits their key against a specific pending payout
 *     hold. Once every assigned participant has submitted, the payout is
 *     released from `vault_pending` into the normal `pending` payout queue
 *     (the "final participant submitting their key triggers payout execution").
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { FieldValue } from "firebase-admin/firestore"

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

async function getActiveAdminCollaboration(eventId: string, userId: string) {
  const snap = await adminDb
    .collection("collaborations")
    .where("eventId", "==", eventId)
    .where("collaboratorId", "==", userId)
    .where("isActive", "==", true)
    .get()
  return snap.docs.find((d) => d.data().role === "admin") ?? null
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
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
    return ok({ vault: { eventId, enabled: false, participants: [] } })
  }

  const vault = vaultSnap.data()!
  return ok({
    vault: {
      eventId,
      enabled: vault.enabled === true,
      enabledAt: vault.enabledAt ?? null,
      participants: (vault.participants ?? []).map((p: any) => ({
        uid: p.uid,
        email: p.email,
        hasSetKey: Boolean(p.keyHash),
        addedAt: p.addedAt ?? null,
      })),
    },
  })
}

// ── POST ─────────────────────────────────────────────────────────────────────
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

  const { eventId, action } = body
  if (!eventId?.trim()) return fail("eventId is required", 400)
  if (!action?.trim()) return fail("action is required", 400)

  const eventRef = adminDb.collection("events").doc(eventId)
  const eventSnap = await eventRef.get()
  if (!eventSnap.exists) return fail("Event not found", 404)
  const isOwner = eventSnap.data()!.organizerId === userId
  const vaultRef = adminDb.collection("vaults").doc(eventId)

  // ── enable ──────────────────────────────────────────────────────────────
  if (action === "enable") {
    if (!isOwner) return fail("Only the Event Creator can enable the Vault", 403)

    const existing = await vaultRef.get()
    if (existing.exists && existing.data()!.enabled) {
      return fail("The Vault is already enabled for this event", 409)
    }

    await vaultRef.set(
      {
        eventId,
        enabled: true,
        enabledAt: FieldValue.serverTimestamp(),
        enabledBy: userId,
        participants: existing.exists ? existing.data()!.participants ?? [] : [],
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    return ok({ message: "Vault enabled. This action cannot be undone by the Creator — an Admin collaborator must deactivate it." })
  }

  // ── disable ─────────────────────────────────────────────────────────────
  if (action === "disable") {
    const adminCollab = await getActiveAdminCollaboration(eventId, userId)
    if (!adminCollab) return fail("Only an Admin collaborator can deactivate the Vault", 403)

    await vaultRef.set(
      { enabled: false, disabledAt: FieldValue.serverTimestamp(), disabledBy: userId, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    )
    return ok({ message: "Vault deactivated." })
  }

  // ── addParticipant ──────────────────────────────────────────────────────
  if (action === "addParticipant") {
    if (!isOwner) return fail("Only the Event Creator can add Vault participants", 403)
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

    const vaultSnap = await vaultRef.get()
    const participants = vaultSnap.exists ? vaultSnap.data()!.participants ?? [] : []
    if (participants.some((p: any) => p.uid === collaboratorId)) {
      return fail("This participant is already in the Vault", 409)
    }

    participants.push({
      uid: collaboratorId,
      email: adminCollab.data().collaboratorEmail,
      keyHash: null,
      addedAt: new Date().toISOString(),
    })

    await vaultRef.set({ eventId, participants, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    return ok({ message: "Participant added to the Vault. They must set their Vault Key before payouts can clear." })
  }

  // ── removeParticipant ───────────────────────────────────────────────────
  if (action === "removeParticipant") {
    if (!isOwner) return fail("Only the Event Creator can remove Vault participants", 403)
    const { collaboratorId } = body
    if (!collaboratorId?.trim()) return fail("collaboratorId is required", 400)

    const vaultSnap = await vaultRef.get()
    if (!vaultSnap.exists) return fail("Vault not configured for this event", 404)

    const participants = (vaultSnap.data()!.participants ?? []).filter((p: any) => p.uid !== collaboratorId)
    await vaultRef.update({ participants, updatedAt: FieldValue.serverTimestamp() })
    return ok({ message: "Participant removed from the Vault." })
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

  const { payoutId, vaultKey } = body
  if (!payoutId?.trim()) return fail("payoutId is required", 400)
  if (!vaultKey?.trim()) return fail("vaultKey is required", 400)

  const payoutRef = adminDb.collection("payouts").doc(payoutId)
  const payoutSnap = await payoutRef.get()
  if (!payoutSnap.exists) return fail("Payout record not found", 404)
  const payout = payoutSnap.data()!

  if (payout.status !== "vault_pending") {
    return fail(`This payout is not awaiting Vault sign-off (status: ${payout.status})`, 400)
  }

  const vaultSnap = await adminDb.collection("vaults").doc(payout.eventId).get()
  if (!vaultSnap.exists) return fail("Vault configuration not found for this event", 404)
  const participants: any[] = vaultSnap.data()!.participants ?? []

  const participant = participants.find((p) => p.uid === userId)
  if (!participant) return fail("You are not a Vault participant on this event", 403)
  if (!participant.keyHash) return fail("You have not set a Vault Key yet", 400)

  const matches = await bcrypt.compare(String(vaultKey), participant.keyHash)
  if (!matches) return fail("Incorrect Vault Key", 401)

  const submissions: Record<string, boolean> = { ...(payout.vaultSubmissions ?? {}), [userId]: true }
  const requiredUids: string[] = payout.vaultParticipants ?? participants.map((p) => p.uid)
  const allSubmitted = requiredUids.every((uid) => submissions[uid])

  if (allSubmitted) {
    await payoutRef.update({
      vaultSubmissions: submissions,
      status: "pending", // released into the normal payout queue
      vaultClearedAt: FieldValue.serverTimestamp(),
      pendingAt: FieldValue.serverTimestamp(),
    })
    return ok({ message: "All Vault Keys submitted. Payout released for processing.", released: true })
  }

  await payoutRef.update({ vaultSubmissions: submissions })
  return ok({
    message: "Vault Key accepted. Waiting on remaining participants.",
    released: false,
    remaining: requiredUids.filter((uid) => !submissions[uid]).length,
  })
}
