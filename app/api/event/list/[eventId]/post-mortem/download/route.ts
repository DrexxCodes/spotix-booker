/**
 * app/api/event/list/[eventId]/post-mortem/download/route.ts
 *
 * GET /api/event/list/:eventId/post-mortem/download
 *
 * Streams the ready Attendee Post Mortem PDF through our own domain
 * instead of handing the client spotix-backend's raw Supabase Storage
 * signed URL. Same "own-domain download URL proxying" pattern already
 * used for poll results — see
 * app/api/polls/[pollId]/results/download/route.ts.
 *
 * spotix-backend is the only service holding Supabase Storage credentials
 * for the `post-mortems` bucket, so we still ask it (via the existing
 * internal /v1/post-mortem/status call) for a short-lived signed URL —
 * we just consume that here, server-side, and pipe the bytes straight
 * back rather than forwarding the signed URL to the browser. The link the
 * user actually sees, opens, or shares always stays on our own domain
 * and never reveals the Supabase project/bucket.
 *
 * Auth: same rule as GET/POST /api/event/list/[eventId]/post-mortem —
 * owner, Admin, or any collaborator role whose tab set includes
 * "attendees".
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { resolveEventAccess, hasTab } from "@/lib/event-access"
import { getPostMortemStatus } from "@/lib/post-mortem-backend"

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

function sanitizeFileName(name: string): string {
  const cleaned = (name || "event")
    .replace(/[^a-z0-9\- _]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80)
  return cleaned || "event"
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { eventId } = await params
  if (!eventId?.trim()) return fail("eventId is required", 400)

  try {
    const access = await resolveEventAccess(eventId, userId)
    if (!access.ok) return fail(access.error, access.status)
    if (!hasTab(access, "attendees")) {
      return fail("Forbidden: you do not have access to this event's attendees", 403)
    }

    const status = await getPostMortemStatus(eventId)
    if (status.status !== "ready" || !status.downloadUrl) {
      return fail("No post mortem report has been generated for this event yet.", 404)
    }

    // Short-lived, used immediately — never sent to the client.
    const upstream = await fetch(status.downloadUrl)
    if (!upstream.ok || !upstream.body) {
      return fail("Failed to fetch the report from storage.", 502)
    }

    const eventName = (access.eventSnap.data() ?? {})?.eventName ?? "event"
    const fileName = `${sanitizeFileName(eventName)}-post-mortem.pdf`

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": upstream.headers.get("content-length") ?? "",
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err: any) {
    console.error("[GET /api/event/list/[eventId]/post-mortem/download]", err)
    return fail("Failed to download the post mortem report.", 500)
  }
}

export async function POST()   { return fail("Method Not Allowed", 405) }
export async function PATCH()  { return fail("Method Not Allowed", 405) }
export async function DELETE() { return fail("Method Not Allowed", 405) }
