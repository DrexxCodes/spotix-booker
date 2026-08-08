/**
 * app/api/polls/list/route.ts
 *
 * GET /api/polls/list
 *
 * Returns all polls owned by the authenticated booker by querying the
 * FLAT voting collection:
 *   voting/{pollId}  where creatorId == userId
 *
 * Also checks for legacy nested polls at voting/{userId}/polls/{pollId}
 * and returns them with a `needsNormalization: true` flag so the UI can
 * prompt the booker to run the Normalize migration.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { Timestamp } from "firebase-admin/firestore"

const DEV_TAG = "spotix-api-v1"

function ok(data: object, status = 200) {
  return NextResponse.json({ success: true, developer: DEV_TAG, ...data }, { status })
}
function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message, developer: DEV_TAG }, { status })
}

function toIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === "object" && "_seconds" in (value as any))
    return new Date((value as any)._seconds * 1000).toISOString()
  if (typeof value === "string" || typeof value === "number")
    return new Date(value).toISOString()
  return null
}

function shapePoll(id: string, d: FirebaseFirestore.DocumentData, needsNormalization = false) {
  return {
    id,
    pollName:        d.pollName        ?? "",
    pollImage:       d.pollImage       ?? "",
    pollDescription: d.pollDescription ?? "",
    pollStartDate:   d.pollStartDate   ?? "",
    pollStartTime:   d.pollStartTime   ?? "",
    pollEndDate:     d.pollEndDate     ?? "",
    pollEndTime:     d.pollEndTime     ?? "",
    pollPrice:       d.pollPrice       ?? 0,
    pollAmount:      d.pollAmount      ?? 0,
    pollCount:       d.pollCount       ?? 0,
    totalPaidOut:    d.totalPaidOut    ?? 0,
    buyerBearsBurden: d.buyerBearsBurden ?? true,
    flagged:         d.flagged         ?? false,
    suspended:       d.suspended       ?? false,
    linkedEventId:   d.linkedEventId   ?? null,
    linkedEventName: d.linkedEventName ?? null,
    contestants:     d.contestants     ?? [],
    // Group-poll fields — previously omitted here, which meant every poll
    // silently fell back to pollType "single" on the booker side and
    // categories/statsVisible were never available to the edit/detail pages.
    pollType:        d.pollType        ?? "single",
    categories:      d.categories      ?? [],
    statsVisible:    d.statsVisible    ?? true,
    creatorId:       d.creatorId       ?? d.organizerId ?? "",
    organizerId:     d.organizerId     ?? d.creatorId   ?? "",
    createdAt:       toIso(d.createdAt),
    updatedAt:       toIso(d.updatedAt),
    needsNormalization,
    // Tie-breaker config + live round state — previously omitted here even
    // though the poll detail page (app/polls/[pollId]/page.tsx) reads
    // poll.enabledTieBreaker/tieBreakerDuration/tieBreakerRounds straight
    // off what this route returns. Without these the "tied — no winner
    // crowned" banner always showed as unconfigured, regardless of what
    // was actually saved via /api/polls/tiebreaker.
    enabledTieBreaker:  d.enabledTieBreaker  ?? false,
    tieBreakerDuration: d.tieBreakerDuration ?? null,
    tieBreakerRounds:   d.tieBreakerRounds   ?? null,
    tieBreakers:        d.tieBreakers        ?? {},
  }
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

export async function GET(_req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    // ── 1. Flat collection: voting/{pollId} where creatorId == userId ─────────
    const flatSnap = await adminDb
      .collection("voting")
      .where("creatorId", "==", userId)
      .orderBy("createdAt", "desc")
      .get()

    const flatPolls = flatSnap.docs.map((doc) => shapePoll(doc.id, doc.data(), false))

    // ── 2. Legacy nested: voting/{userId}/polls/{pollId} ──────────────────────
    // Only check if the parent doc exists (avoids an unnecessary subcollection scan)
    let legacyPolls: ReturnType<typeof shapePoll>[] = []

    try {
      const legacyParent = await adminDb.collection("voting").doc(userId).get()

      if (legacyParent.exists) {
        const legacySnap = await adminDb
          .collection("voting")
          .doc(userId)
          .collection("polls")
          .orderBy("createdAt", "desc")
          .get()

        const flatPollIds = new Set(flatPolls.map((p) => p.id))

        legacyPolls = legacySnap.docs
          // Skip any that have already been migrated (same pollId exists in flat)
          .filter((doc) => !flatPollIds.has(doc.id))
          .map((doc) => shapePoll(doc.id, doc.data(), true))
      }
    } catch {
      // Legacy path doesn't exist — not an error
    }

    const polls = [...flatPolls, ...legacyPolls]

    return ok({ polls, hasLegacy: legacyPolls.length > 0 })
  } catch (err: any) {
    console.error("[GET /api/polls/list] error:", err.code, err.message)
    return fail("Internal Server Error", 500)
  }
}

export async function POST() {
  return fail("Method Not Allowed", 405)
}
