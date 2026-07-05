/**
 * app/api/polls/normalize/route.ts
 *
 * POST /api/polls/normalize
 *
 * Migrates a single legacy poll from the nested path:
 *   voting/{creatorId}/polls/{pollId}
 * into the flat path:
 *   voting/{pollId}   (same document ID, creatorId stored as a field)
 *
 * Then deletes the original nested document.
 * The parent document (voting/{creatorId}) is left untouched — it may be
 * used by the original user-portal voting-utils.
 *
 * Body: { pollId: string }
 *
 * Idempotent — if the flat doc already exists, returns success immediately.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
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

export async function POST(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try { body = await req.json() }
  catch { return fail("Invalid JSON body", 400) }

  const { pollId } = body
  if (!pollId?.trim()) return fail("pollId is required", 400)

  // ── 1. Check flat doc — already normalized ────────────────────────────────
  const flatRef = adminDb.collection("voting").doc(pollId)
  const flatSnap = await flatRef.get()

  if (flatSnap.exists) {
    const d = flatSnap.data()!
    // Verify ownership before confirming success
    if (d.creatorId !== userId && d.organizerId !== userId) {
      return fail("Poll not owned by this account", 403)
    }
    return ok({ message: "Poll is already normalized", pollId, alreadyDone: true })
  }

  // ── 2. Read from legacy nested path ───────────────────────────────────────
  const legacyRef = adminDb
    .collection("voting")
    .doc(userId)
    .collection("polls")
    .doc(pollId)

  const legacySnap = await legacyRef.get()

  if (!legacySnap.exists) {
    return fail(
      "Poll not found in either the flat or nested collection. Nothing to normalize.",
      404
    )
  }

  const legacyData = legacySnap.data()!

  // ── 3. Write to flat voting/{pollId} ──────────────────────────────────────
  try {
    await flatRef.set({
      ...legacyData,
      // Ensure both ID aliases are present
      creatorId:   userId,
      organizerId: userId,
      // Stamp a migration marker
      normalizedAt: FieldValue.serverTimestamp(),
      updatedAt:    FieldValue.serverTimestamp(),
    })
  } catch (err: any) {
    console.error("[normalize] Failed to write flat doc:", err)
    return fail("Failed to write normalized poll document", 500)
  }

  // ── 4. Delete legacy nested doc ───────────────────────────────────────────
  try {
    await legacyRef.delete()
  } catch (err: any) {
    // Non-fatal — flat doc is already written, log and continue
    console.warn("[normalize] Could not delete legacy doc (non-fatal):", err.message)
  }

  return ok({ message: "Poll normalized successfully", pollId })
}

export async function GET() {
  return fail("Method Not Allowed", 405)
}
