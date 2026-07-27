/**
 * app/api/sdk/keys/route.ts
 *
 * GET  /api/sdk/keys
 *   → List every API key belonging to the authenticated user, with live
 *     rpm/rpd usage pulled from Redis. Never returns the raw key.
 *
 * POST /api/sdk/keys
 *   Body: { label }
 *   → Creates a new live API key bound to the caller's uid (Tied access by
 *     default). Returns the raw key exactly once — store it in Firestore
 *     only as a sha256 hash, per spec §1.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createHash, randomBytes } from "crypto"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { redis, minuteBucket, dayBucketWAT } from "@/lib/redis"
import { FieldValue } from "firebase-admin/firestore"

const DEV_TAG = "spotix-api-v1"
const DEFAULT_RATE_LIMIT = { rpm: 500, rpd: 1000 }
const MAX_KEYS_PER_USER = 10

function ok(data: object, status = 200) {
  return NextResponse.json({ success: true, developer: DEV_TAG, ...data }, { status })
}
function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message, developer: DEV_TAG }, { status })
}

async function authenticate(): Promise<{ userId: string; email: string } | NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get("spotix_at")?.value
  if (!token) return fail("No access token", 401)
  try {
    const payload = await verifyAccessToken(token, "spotix-booker")
    return { userId: payload.uid, email: payload.email }
  } catch {
    return fail("Invalid or expired access token", 401)
  }
}

function generateRawKey(): string {
  return `spk_live_${randomBytes(24).toString("hex")}`
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const snap = await adminDb.collection("apiKeys").where("uid", "==", userId).get()

    const keys = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data()
        const keyHash = doc.id

        const [rpmUsed, rpdUsed] = await Promise.all([
          redis.get<number>(`rl:rpm:${keyHash}:${minuteBucket()}`),
          redis.get<number>(`rl:rpd:${keyHash}:${dayBucketWAT()}`),
        ])

        return {
          keyHash,
          label: data.label,
          keyPreview: data.keyPreview,
          accessType: data.accessType ?? "tied",
          status: data.status ?? "active",
          orgKey: data.orgKey ?? null,
          rateLimit: data.rateLimit ?? DEFAULT_RATE_LIMIT,
          usage: {
            rpm: rpmUsed ?? 0,
            rpd: rpdUsed ?? 0,
          },
          generalAccessRequest: data.generalAccessRequest ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        }
      })
    )

    keys.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    return ok({ keys })
  } catch (err: any) {
    console.error("[GET /api/sdk/keys] error:", err)
    return fail("Internal Server Error", 500)
  }
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

  const label = String(body.label ?? "").trim()
  if (!label) return fail("label is required", 400)

  try {
    const existingSnap = await adminDb.collection("apiKeys").where("uid", "==", userId).get()
    if (existingSnap.size >= MAX_KEYS_PER_USER) {
      return fail(`You can have at most ${MAX_KEYS_PER_USER} API keys. Revoke one first.`, 409)
    }

    const rawKey = generateRawKey()
    const keyHash = createHash("sha256").update(rawKey).digest("hex")
    const keyPreview = `...${rawKey.slice(-4)}`

    await adminDb
      .collection("apiKeys")
      .doc(keyHash)
      .set({
        uid: userId,
        label,
        keyPreview,
        accessType: "tied",
        status: "active",
        orgKey: null,
        rateLimit: DEFAULT_RATE_LIMIT,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

    return ok(
      {
        message: "API key created. Copy it now — it will not be shown again.",
        apiKey: rawKey,
        keyHash,
        keyPreview,
      },
      201
    )
  } catch (err: any) {
    console.error("[POST /api/sdk/keys] error:", err)
    return fail("Internal Server Error", 500)
  }
}
