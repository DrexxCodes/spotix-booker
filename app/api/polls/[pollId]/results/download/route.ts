/**
 * app/api/polls/[pollId]/results/download/route.ts
 *
 * GET /api/polls/:pollId/results/download
 *
 * Streams the latest generated results PDF through our own domain instead
 * of handing the client a raw Supabase Storage signed URL. Same auth rule
 * as the rest of this poll's results endpoints (owner OR an active poll
 * team member) — see @/lib/poll-team-access.
 *
 * The `poll-results` bucket is private, so a short-lived Supabase signed
 * URL is still required to actually read the file — we just create and
 * consume it here, server-side, and pipe the bytes straight back. The URL
 * the user actually sees, clicks, or shares always stays on our own
 * domain and never reveals the Supabase project/bucket.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { resolvePollAccess } from "@/lib/poll-team-access"
import { getLatestPollResult, getSignedResultUrl } from "@/lib/poll-results-store"

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { pollId } = await params

  try {
    const access = await resolvePollAccess(pollId, userId)
    if (!access.ok) return fail(access.error, access.status)

    const latest = await getLatestPollResult(pollId)
    if (!latest || latest.status !== "ready") {
      return fail("No report has been generated for this poll yet.", 404)
    }

    // Short-lived, used immediately — never sent to the client.
    const signedUrl = await getSignedResultUrl(latest.storagePath)
    const upstream = await fetch(signedUrl)
    if (!upstream.ok || !upstream.body) {
      return fail("Failed to fetch the report from storage.", 502)
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${latest.fileName}"`,
        "Content-Length": upstream.headers.get("content-length") ?? "",
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err: any) {
    console.error("[GET /api/polls/[pollId]/results/download]", err)
    return fail("Failed to download results.", 500)
  }
}

export async function POST()   { return fail("Method Not Allowed", 405) }
export async function PATCH()  { return fail("Method Not Allowed", 405) }
export async function DELETE() { return fail("Method Not Allowed", 405) }
