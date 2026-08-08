/**
 * app/api/polls/tiebreaker/route.ts
 *
 * GET  /api/polls/tiebreaker?pollId=xxx
 *   → Returns the poll's current tie-breaker configuration.
 *
 * POST /api/polls/tiebreaker
 *   Body: { pollId, enabledTieBreaker, tieBreakerDuration?, tieBreakerRounds? }
 *   → Saves tie-breaker configuration to voting/{pollId}.
 *
 * Tie-breaker fields on voting/{pollId}:
 *   enabledTieBreaker   boolean          — whether ties on this poll trigger a tie-breaker
 *   tieBreakerDuration   number (hours)  — how long each tie-breaker round stays open, required when enabled
 *   tieBreakerRounds     number | null   — optional cap on rounds before falling back to
 *                                          first-past-the-post. Null/unset = a single round,
 *                                          then FPTP, matching the same default used for
 *                                          display in app/polls/[pollId]/page.tsx.
 *
 * This route only persists the *configuration*. Detecting a tie once a poll
 * ends, opening a scoped round for the tied contestants, crediting votes
 * cast during that round, advancing rounds, and falling back to
 * first-past-the-post all happen in the vote-crediting webhook and the
 * voter-facing polling page — outside this codebase.
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

// ── GET: current tie-breaker config ───────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const pollId = req.nextUrl.searchParams.get("pollId")
  if (!pollId) return fail("pollId is required", 400)

  try {
    const pollSnap = await adminDb.collection("voting").doc(pollId).get()
    if (!pollSnap.exists) return fail("Poll not found", 404)
    const d = pollSnap.data()!
    if (d.creatorId !== userId && d.organizerId !== userId)
      return fail("Forbidden", 403)

    return ok({
      pollId,
      enabledTieBreaker:  d.enabledTieBreaker  ?? false,
      tieBreakerDuration: d.tieBreakerDuration ?? null,
      tieBreakerRounds:   d.tieBreakerRounds   ?? null,
    })
  } catch (err) {
    console.error("[GET /api/polls/tiebreaker]", err)
    return fail("Internal server error", 500)
  }
}

// ── POST: save tie-breaker config ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: {
    pollId?: string
    enabledTieBreaker?: boolean
    tieBreakerDuration?: number | null
    tieBreakerRounds?: number | null
  }
  try { body = await req.json() } catch { return fail("Invalid JSON body", 400) }

  const { pollId, enabledTieBreaker, tieBreakerDuration, tieBreakerRounds } = body
  if (!pollId) return fail("pollId is required", 400)
  if (typeof enabledTieBreaker !== "boolean") return fail("enabledTieBreaker must be a boolean", 400)

  // Duration is required whenever tie-breaker is turned on
  if (enabledTieBreaker) {
    const duration = Number(tieBreakerDuration)
    if (!tieBreakerDuration || Number.isNaN(duration) || duration <= 0) {
      return fail("tieBreakerDuration (in hours) is required and must be greater than 0 when tie-breaker is enabled", 400)
    }
    if (duration > 24 * 14) {
      return fail("tieBreakerDuration can't exceed 336 hours (14 days)", 400)
    }
  }

  // Rounds are optional but must be a positive whole number if provided
  let normalizedRounds: number | null = null
  if (tieBreakerRounds !== null && tieBreakerRounds !== undefined && tieBreakerRounds !== "" as any) {
    const rounds = Number(tieBreakerRounds)
    if (Number.isNaN(rounds) || !Number.isInteger(rounds) || rounds < 1) {
      return fail("tieBreakerRounds must be a whole number of 1 or more when provided", 400)
    }
    if (rounds > 20) {
      return fail("tieBreakerRounds can't exceed 20", 400)
    }
    normalizedRounds = rounds
  }

  try {
    const pollRef  = adminDb.collection("voting").doc(pollId)
    const pollSnap = await pollRef.get()
    if (!pollSnap.exists) return fail("Poll not found", 404)
    const pollData = pollSnap.data()!
    if (pollData.creatorId !== userId && pollData.organizerId !== userId)
      return fail("Forbidden", 403)

    await pollRef.update({
      enabledTieBreaker:  enabledTieBreaker,
      tieBreakerDuration: enabledTieBreaker ? Number(tieBreakerDuration) : (pollData.tieBreakerDuration ?? null),
      tieBreakerRounds:   enabledTieBreaker ? normalizedRounds : (pollData.tieBreakerRounds ?? null),
      updatedAt:          FieldValue.serverTimestamp(),
    })

    return ok({
      message:            "Tie-breaker settings saved",
      enabledTieBreaker,
      tieBreakerDuration: enabledTieBreaker ? Number(tieBreakerDuration) : (pollData.tieBreakerDuration ?? null),
      tieBreakerRounds:   enabledTieBreaker ? normalizedRounds : (pollData.tieBreakerRounds ?? null),
    })
  } catch (err) {
    console.error("[POST /api/polls/tiebreaker]", err)
    return fail("Internal server error", 500)
  }
}
