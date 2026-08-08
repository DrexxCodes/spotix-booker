/**
 * app/api/polls/entries/route.ts
 *
 * GET /api/polls/entries?pollId=xxx&cursor=<reference>&limit=25
 *
 * Paginated read of voting/{pollId}/entries — the scalable per-vote record
 * collection written by backend v1/voting.js (replaces the old unbounded
 * voting/{pollId}.pollEntries array).
 *
 * Ordered by `date` descending (most recent vote first).
 * Cursor-based pagination: pass the `reference` of the last entry on the
 * current page as `cursor` to fetch the next page.
 *
 * Access-checked: the poll's creator/organizer OR an active poll team
 * member can list its entries (see app/lib/poll-team-access.ts) — viewing
 * vote stats/entries is part of the edit-page access granted to a poll
 * team member.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { resolvePollAccess } from "@/lib/poll-team-access"
import { Timestamp } from "firebase-admin/firestore"

const DEV_TAG = "spotix-api-v1"
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

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
  if (typeof value === "string" || typeof value === "number") return new Date(value).toISOString()
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
  const cursor = req.nextUrl.searchParams.get("cursor")
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT)
  const pageLimit = Math.min(Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam), MAX_LIMIT)

  if (!pollId?.trim()) return fail("pollId is required", 400)

  try {
    const access = await resolvePollAccess(pollId, userId)
    if (!access.ok) return fail(access.error, access.status)

    const pollRef = adminDb.collection("voting").doc(pollId)

    let query = pollRef
      .collection("entries")
      .orderBy("date", "desc")
      .limit(pageLimit)

    if (cursor) {
      const cursorSnap = await pollRef.collection("entries").doc(cursor).get()
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap)
      }
    }

    const snap = await query.get()

    const entries = snap.docs.map((doc) => {
      const d = doc.data()
      return {
        reference:       doc.id,
        uid:             d.uid ?? null,
        payerName:       d.payerName ?? null,
        payerEmail:      d.payerEmail ?? null,
        payerPhone:      d.payerPhone ?? null,
        voteCount:       d.voteCount ?? 0,
        price:           d.price ?? 0,
        contestantId:    d.contestantId ?? "",
        contestantName:  d.contestantName ?? "",
        categoryId:      d.categoryId ?? null,
        isGuest:         d.isGuest ?? false,
        totalAmount:     d.totalAmount ?? 0,
        netAmount:       d.netAmount ?? 0,
        buyerBearsBurden: d.buyerBearsBurden ?? true,
        serviceFee:      d.serviceFee ?? 0,
        date:            toIso(d.date) ?? d.date ?? null,
      }
    })

    const lastDoc = snap.docs[snap.docs.length - 1]

    return ok({
      pollId,
      entries,
      nextCursor: entries.length === pageLimit && lastDoc ? lastDoc.id : null,
      hasMore:    entries.length === pageLimit,
    })
  } catch (err) {
    console.error("[GET /api/polls/entries] error:", err)
    return fail("Internal Server Error", 500)
  }
}

export async function POST() { return fail("Method Not Allowed", 405) }
