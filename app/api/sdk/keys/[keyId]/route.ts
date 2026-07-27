/**
 * app/api/sdk/keys/[keyId]/route.ts
 * (keyId = the key's sha256 hash, i.e. the Firestore doc id under apiKeys/)
 *
 * PATCH /api/sdk/keys/:keyId
 *   Body: { label? , orgKey? , requestGeneralAccess?: { reason } }
 *   → Owner-only edits: rename, attach/detach an orgKey, or submit a
 *     Tied → General access-upgrade request for admin review (spec §5).
 *
 * DELETE /api/sdk/keys/:keyId
 *   → Revokes (deletes) the key. Owner-only.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { redis } from "@/lib/redis"
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

async function loadOwnedKey(keyHash: string, userId: string) {
  const ref = adminDb.collection("apiKeys").doc(keyHash)
  const snap = await ref.get()
  if (!snap.exists) return fail("API key not found", 404)
  if (snap.data()!.uid !== userId) return fail("Forbidden", 403)
  return { ref, snap }
}

// ── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ keyId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { keyId } = await params

  const owned = await loadOwnedKey(keyId, userId)
  if (owned instanceof NextResponse) return owned
  const { ref } = owned

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return fail("Invalid JSON body", 400)
  }

  const update: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() }

  if (typeof body.label === "string" && body.label.trim()) {
    update.label = body.label.trim()
  }

  if (body.orgKey !== undefined) {
    update.orgKey = body.orgKey === null ? null : String(body.orgKey).trim()
  }

  if (body.requestGeneralAccess) {
    const reason = String(body.requestGeneralAccess.reason ?? "").trim()
    if (!reason) return fail("A business reason is required to request General access", 400)
    update.generalAccessRequest = {
      status: "pending",
      reason,
      requestedAt: FieldValue.serverTimestamp(),
    }
  }

  if (Object.keys(update).length === 1) {
    return fail("No valid fields to update", 400)
  }

  try {
    await ref.update(update)
    await redis.del(`apikey:${keyId}`) // invalidate spotix-api's 60s cache
    return ok({ message: "API key updated." })
  } catch (err: any) {
    console.error("[PATCH /api/sdk/keys/:keyId] error:", err)
    return fail("Internal Server Error", 500)
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ keyId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { keyId } = await params

  const owned = await loadOwnedKey(keyId, userId)
  if (owned instanceof NextResponse) return owned
  const { ref } = owned

  try {
    await ref.delete()
    await redis.del(`apikey:${keyId}`)
    return ok({ message: "API key revoked." })
  } catch (err: any) {
    console.error("[DELETE /api/sdk/keys/:keyId] error:", err)
    return fail("Internal Server Error", 500)
  }
}
