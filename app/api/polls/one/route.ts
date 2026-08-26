/**
 * app/api/polls/one/route.ts
 *
 * GET /api/polls/one?pollId=<id>
 *
 * Returns a single poll from the FLAT voting/{pollId} collection to
 * whoever is allowed to see it — the poll's creator OR an active poll
 * team member (see app/lib/poll-team-access.ts). Unlike
 * /api/polls/list (owner-only, used for the booker's "My Polls"
 * dashboard), this endpoint is what the Edit page uses so an added team
 * mate can open a poll they don't own by following the link in their
 * invite email.
 *
 * Response includes an `access: "owner" | "member"` field so the client
 * can adjust the UI (e.g. show a "Team Member" badge, hide anything that
 * isn't relevant to editing).
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { resolvePollAccess } from "@/lib/poll-team-access"
import { fetchCategoryTree } from "@/lib/poll-categories"
import { resolvePollLimits } from "@/lib/poll-config"
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

export async function GET(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const pollId = req.nextUrl.searchParams.get("pollId")
  if (!pollId?.trim()) return fail("pollId is required", 400)

  try {
    const access = await resolvePollAccess(pollId, userId)
    if (!access.ok) return fail(access.error, access.status)

    const d = access.pollSnap.data()!

    // Categories live in the voting/{pollId}/categories subcollection —
    // see lib/poll-categories.ts. skipCache: true because this is the
    // edit page's data source; an organiser editing right after a vote
    // came in should see the real current vote counts, not up to an
    // hour-old cached ones.
    const categories =
      (d.pollType ?? "single") === "group"
        ? await fetchCategoryTree(pollId, { legacyCategories: d.categories ?? [], skipCache: true })
        : []

    return ok({
      access: access.role,
      poll: {
        id: access.pollSnap.id,
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
        buyerBearsBurden: d.buyerBearsBurden ?? true,
        linkedEventId:   d.linkedEventId   ?? null,
        linkedEventName: d.linkedEventName ?? null,
        contestants:     d.contestants     ?? [],
        pollType:        d.pollType        ?? "single",
        categories,
        statsVisible:    d.statsVisible    ?? true,
        contestantsTBD:  d.contestantsTBD  ?? false,
        // Admin-configurable structure limits for THIS poll — falls back to
        // platform defaults if no admin override is on file. The create/edit
        // UI should validate against these instead of the hardcoded
        // constants in lib/poll-config.ts, since an admin may have raised
        // or lowered them for this specific poll.
        limits:          resolvePollLimits(d.limitsOverride),
        creatorId:       d.creatorId       ?? d.organizerId ?? "",
        organizerId:     d.organizerId     ?? d.creatorId   ?? "",
        createdAt:       toIso(d.createdAt),
        updatedAt:       toIso(d.updatedAt),
      },
    })
  } catch (err: any) {
    console.error("[GET /api/polls/one]", err)
    return fail("Internal server error", 500)
  }
}

export async function POST()   { return fail("Method Not Allowed", 405) }
export async function PATCH()  { return fail("Method Not Allowed", 405) }
export async function DELETE() { return fail("Method Not Allowed", 405) }
