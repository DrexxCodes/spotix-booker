/**
 * app/api/activity/recent/route.ts
 *
 * GET /api/activity/recent
 *
 * Harmonized "recent activity" feed for the PWA dashboard: the booker's
 * last 5 polls/nominations, newest first, regardless of which system each
 * lives in —
 *
 *   - Voting polls  → Firestore voting/{pollId}, creatorId == userId
 *   - Nominations   → Supabase nomination_polls, creator_id == userId
 *     (reuses listNominationPollsByCreator — same helper the web
 *     nominations list already calls, see lib/nomination-db.ts)
 *
 * Each item is tagged `kind: "voting" | "nomination"` so the UI can render
 * the small "Voting" / "Nomination" pill without the client needing to
 * know which backend it came from.
 */

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { Timestamp } from "firebase-admin/firestore"
import { listNominationPollsByCreator } from "@/lib/nomination-db"

const DEV_TAG = "spotix-api-v1"
const RESULT_LIMIT = 5
// Pull a few more than we need from each source before merging + slicing,
// since a booker could have created 5 nominations in a row and no polls
// (or vice versa) right before the cutoff.
const FETCH_LIMIT = 10

function ok(data: object, status = 200) {
  return NextResponse.json({ success: true, developer: DEV_TAG, ...data }, { status })
}
function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message, developer: DEV_TAG }, { status })
}

function toIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === "object" && value !== null && "_seconds" in (value as any)) {
    return new Date((value as any)._seconds * 1000).toISOString()
  }
  if (typeof value === "string" || typeof value === "number") return new Date(value).toISOString()
  return null
}

interface ActivityItem {
  id: string
  kind: "voting" | "nomination"
  pollName: string
  pollImage: string
  status: string
  createdAt: string | null
  linkedEventName: string | null
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("spotix_at")?.value
  if (!token) return fail("No access token", 401)

  let userId: string
  try {
    const payload = await verifyAccessToken(token, "spotix-booker")
    userId = payload.uid
  } catch {
    return fail("Invalid or expired access token", 401)
  }

  try {
    const [votingSnap, nominationPolls] = await Promise.all([
      adminDb
        .collection("voting")
        .where("creatorId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(FETCH_LIMIT)
        .get(),
      listNominationPollsByCreator(userId).catch((err) => {
        console.error("[GET /api/activity/recent] nomination fetch failed:", err)
        return []
      }),
    ])

    const votingItems: ActivityItem[] = votingSnap.docs.map((doc) => {
      const d = doc.data()
      return {
        id: doc.id,
        kind: "voting",
        pollName: d.pollName ?? "",
        pollImage: d.pollImage ?? "",
        status: d.suspended ? "suspended" : d.flagged ? "flagged" : "active",
        createdAt: toIso(d.createdAt),
        linkedEventName: d.linkedEventName ?? null,
      }
    })

    const nominationItems: ActivityItem[] = nominationPolls.slice(0, FETCH_LIMIT).map((p) => ({
      id: p.pollId,
      kind: "nomination",
      pollName: p.pollName,
      pollImage: p.pollImage,
      status: p.status,
      createdAt: p.createdAt,
      linkedEventName: null,
    }))

    const merged = [...votingItems, ...nominationItems]
      .filter((item) => item.createdAt)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, RESULT_LIMIT)

    return ok({ items: merged })
  } catch (err: any) {
    console.error("[GET /api/activity/recent] error:", err.code, err.message)
    return fail("Internal Server Error", 500)
  }
}
