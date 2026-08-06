/**
 * app/api/payout/vault-notify/route.ts
 *
 * POST /api/payout/vault-notify
 *   Body: { eventId, dates: string[], amount: number, payoutIds?: string[] }
 *
 * Called once by payout-confirmation.tsx right after a Vault-locked payout
 * request (single day, or the whole batch on a bulk request) is created —
 * NOT once per day. That's what bundles "the day or days (if in bulk)"
 * into a single email per Vault participant instead of spamming one email
 * per date.
 *
 * This route is the thing that "knows where Vault partner emails are
 * stored" — it reads `vaults/{eventId}.participants[].email` itself
 * server-side (never trusts a client-supplied participant list), filters
 * the requester out, and forwards the resolved emails to spotix-api's
 * POST /v1/notify/vault-notify, which does the actual sending.
 *
 * Deliberately best-effort: the payout record was already created by the
 * time this is called, so a failure here (network hiccup, backend down)
 * must never surface as a failed payout to the person who just submitted
 * one. Errors are swallowed into a `notified: 0` / `warning` response.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { resolvePayoutAccess } from "@/lib/payout-access"

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

async function getUserDisplay(uid: string): Promise<{ name: string; email: string }> {
  try {
    const doc = await adminDb.collection("users").doc(uid).get()
    const d = doc.data()
    return { name: d?.fullName || d?.email || "Unknown", email: d?.email || "" }
  } catch {
    return { name: "Unknown", email: "" }
  }
}

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

  const { eventId, dates, amount, payoutIds } = body
  if (!eventId?.trim()) return fail("eventId is required", 400)
  if (!Array.isArray(dates) || dates.length === 0) return fail("dates must be a non-empty array", 400)
  if (amount === undefined || amount === null || typeof amount !== "number" || amount <= 0) {
    return fail("amount must be a positive number", 400)
  }

  // Confirm the caller actually has payout access on this event, and get
  // their role + event doc for the email copy.
  const access = await resolvePayoutAccess(eventId, userId)
  if (!access.ok) return fail(access.error, access.status)

  const eventName = access.eventSnap.data()?.eventName ?? "your event"
  const roleLabel =
    access.role === "owner" ? "Event Creator" : access.role === "admin" ? "Admin" : access.role === "accountant" ? "Accountant" : "Team member"

  // ── Resolve Vault participants server-side ─────────────────────────────────
  // This is where Vault partner emails actually live: vaults/{eventId}.participants
  const vaultSnap = await adminDb.collection("vaults").doc(eventId).get()
  const vaultParticipants: any[] = vaultSnap.exists ? vaultSnap.data()?.participants ?? [] : []

  if (vaultParticipants.length === 0) {
    // Nothing to notify — Vault isn't enabled, or has no participants.
    return ok({ message: "No Vault participants configured — nothing to notify.", notified: 0 })
  }

  const requester = await getUserDisplay(userId)

  // Never include the requester — they already know they just requested this.
  const participants = vaultParticipants
    .filter((p: any) => p.uid !== userId && p.email)
    .map((p: any) => ({ uid: p.uid, email: p.email, name: p.isCreator ? "Event Creator" : "Admin" }))

  if (participants.length === 0) {
    return ok({ message: "No other Vault participants to notify.", notified: 0 })
  }

  try {
    const backendRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/notify/vault-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        eventName,
        requesterUid: userId,
        requesterName: requester.name,
        requesterEmail: requester.email,
        requesterRoleLabel: roleLabel,
        amount,
        dates,
        payoutIds: Array.isArray(payoutIds) ? payoutIds : [],
        participants,
      }),
    })

    const data = await backendRes.json().catch(() => ({}))
    if (!backendRes.ok) {
      console.warn("[POST /api/payout/vault-notify] backend responded with an error:", data)
      return ok({ message: "Payout was recorded, but the Vault notification email could not be sent.", notified: 0, warning: data?.message })
    }

    return ok({ message: "Vault participants notified.", notified: data?.notified ?? participants.length })
  } catch (err: any) {
    console.error("[POST /api/payout/vault-notify] error reaching notification service:", err)
    return ok({ message: "Payout was recorded, but the Vault notification email could not be sent.", notified: 0 })
  }
}
