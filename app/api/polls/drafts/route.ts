/**
 * app/api/polls/drafts/route.ts
 *
 * POST /api/polls/drafts → save (create or update) a draft
 *   Body: { draftId?: string, kind: "poll" | "nomination", label?: string, data: any }
 *
 * GET  /api/polls/drafts?kind=poll|nomination → list the caller's drafts
 *   (metadata only — not the full `data` payload, to keep the list light)
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { saveDraft, listDrafts, getDraft, type DraftKind } from "@/lib/poll-drafts"

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

  const { draftId, kind, label, data } = body

  if (!["poll", "nomination"].includes(kind)) return fail("kind must be 'poll' or 'nomination'", 400)
  if (data === undefined || data === null) return fail("data is required", 400)

  // If updating an existing draft, make sure the caller actually owns it —
  // Redis has no ACLs, so ownership is enforced by namespacing the key with
  // userId and just checking it resolves before we let a draftId through.
  if (draftId) {
    const existing = await getDraft(userId, draftId)
    if (!existing) return fail("Draft not found or expired", 404)
  }

  try {
    const result = await saveDraft(
      userId,
      kind as DraftKind,
      data,
      String(label || "Untitled").trim() || "Untitled",
      draftId
    )
    return ok({ draftId: result.draftId, updatedAt: result.updatedAt, message: "Draft saved" }, draftId ? 200 : 201)
  } catch (err) {
    console.error("[POST /api/polls/drafts] error:", err)
    return fail("Failed to save draft", 500)
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const kind = req.nextUrl.searchParams.get("kind")
  if (!["poll", "nomination"].includes(kind || "")) return fail("kind must be 'poll' or 'nomination'", 400)

  try {
    const drafts = await listDrafts(userId, kind as DraftKind)
    return ok({
      drafts: drafts.map((d) => ({ draftId: d.draftId, kind: d.kind, label: d.label, updatedAt: d.updatedAt })),
    })
  } catch (err) {
    console.error("[GET /api/polls/drafts] error:", err)
    return fail("Failed to fetch drafts", 500)
  }
}
