/**
 * app/api/event/list/[eventId]/attendees/route.ts
 *
 * GET /api/event/list/[eventId]/attendees
 *
 *   Default (browse):        ?limit=15&cursor=<lastDocId>
 *     → { attendees, nextCursor, hasMore, totalCount, checkedInCount, notCheckedInCount }
 *     Reads only `limit` docs (+ 1 cursor-doc re-fetch when paging), not the
 *     whole collection. totalCount/checkedInCount use Firestore's count()
 *     aggregation, which is a single read regardless of collection size.
 *
 *   Full list:                ?all=true
 *     → { attendees }  (every attendee — used for the "search everyone" case
 *       and for the guest-registry export dialog, both of which genuinely
 *       need the complete set)
 *
 *   Single attendee lookup:   ?email=<email>
 *     → { attendees }  (just that person's ticket(s) — used by the
 *       attendee-detail card so clicking a row doesn't need the full list)
 *
 * Auth: same spotix_at cookie + resolveEventAccess as the rest of
 * event-info — owner, Admin, or any collaborator role whose tab set
 * includes "attendees".
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { resolveEventAccess, hasTab } from "@/lib/event-access"
import { mapAttendeeDoc } from "@/lib/event-bundle"

const DEV_TAG = "spotix-api-v1"

function ok(data: object, status = 200) {
  return NextResponse.json({ success: true, developer: DEV_TAG, ...data }, { status })
}

function fail(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message, developer: DEV_TAG },
    { status }
  )
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

const DEFAULT_PAGE_SIZE = 15
const MAX_PAGE_SIZE = 50

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { eventId } = await params
  if (!eventId?.trim()) return fail("eventId is required", 400)

  const access = await resolveEventAccess(eventId, userId)
  if (!access.ok) return fail(access.error, access.status)
  if (!hasTab(access, "attendees")) {
    return fail("Forbidden: you do not have access to this event's attendees", 403)
  }

  const attendeesCol = access.eventRef.collection("attendees")
  const emailFilter = req.nextUrl.searchParams.get("email")?.trim()
  const wantsAll = req.nextUrl.searchParams.get("all") === "true"

  // ── Single attendee lookup — powers the ticket-breakdown card. Only
  // reads the docs for that one email, not the whole collection. ──
  if (emailFilter) {
    try {
      const snap = await attendeesCol.where("email", "==", emailFilter).get()
      return ok({ attendees: snap.docs.map(mapAttendeeDoc) })
    } catch (e: any) {
      console.error("[GET attendees] email lookup failed", e)
      return fail("Failed to load attendee", 500)
    }
  }

  // ── Full list — only for the "search everyone" fallback and the guest
  // registry export dialog, both of which genuinely need every record. ──
  if (wantsAll) {
    try {
      const snap = await attendeesCol.get()
      return ok({ attendees: snap.docs.map(mapAttendeeDoc) })
    } catch (e: any) {
      console.error("[GET attendees] full-list fetch failed", e)
      return fail("Failed to load attendees", 500)
    }
  }

  // ── Default: paginated browse, 15 at a time ──
  const limitParam = parseInt(req.nextUrl.searchParams.get("limit") ?? "", 10)
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE
  const cursorId = req.nextUrl.searchParams.get("cursor")

  try {
    let query = attendeesCol.orderBy("purchaseDate", "desc").limit(limit + 1)

    if (cursorId) {
      const cursorSnap = await attendeesCol.doc(cursorId).get()
      if (cursorSnap.exists) query = query.startAfter(cursorSnap)
    }

    const [pageSnap, totalAgg, checkedInAgg] = await Promise.all([
      query.get(),
      attendeesCol.count().get(),
      attendeesCol.where("verified", "==", true).count().get(),
    ])

    const docs = pageSnap.docs
    const hasMore = docs.length > limit
    const pageDocs = hasMore ? docs.slice(0, limit) : docs

    const totalCount = totalAgg.data().count
    const checkedInCount = checkedInAgg.data().count

    return ok({
      attendees: pageDocs.map(mapAttendeeDoc),
      nextCursor: hasMore ? pageDocs[pageDocs.length - 1].id : null,
      hasMore,
      totalCount,
      checkedInCount,
      notCheckedInCount: totalCount - checkedInCount,
    })
  } catch (e: any) {
    console.error("[GET attendees] paginated fetch failed", e)
    return fail("Failed to load attendees", 500)
  }
}
