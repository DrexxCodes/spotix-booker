/**
 * app/api/polls/drafts/[draftId]/route.ts
 *
 * GET    /api/polls/drafts/:draftId → fetch the full draft (used to restore it)
 * DELETE /api/polls/drafts/:draftId?kind=poll|nomination → discard a draft
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { getDraft, deleteDraft, type DraftKind } from "@/lib/poll-drafts"

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { draftId } = await params

  try {
    const draft = await getDraft(userId, draftId)
    if (!draft) return fail("Draft not found or expired", 404)
    return ok({ draft })
  } catch (err) {
    console.error("[GET /api/polls/drafts/[draftId]] error:", err)
    return fail("Failed to fetch draft", 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { draftId } = await params
  const kind = req.nextUrl.searchParams.get("kind")

  if (!["poll", "nomination"].includes(kind || "")) return fail("kind must be 'poll' or 'nomination'", 400)

  try {
    const existing = await getDraft(userId, draftId)
    if (!existing) return fail("Draft not found or expired", 404)

    await deleteDraft(userId, kind as DraftKind, draftId)
    return ok({ message: "Draft deleted" })
  } catch (err) {
    console.error("[DELETE /api/polls/drafts/[draftId]] error:", err)
    return fail("Failed to delete draft", 500)
  }
}
