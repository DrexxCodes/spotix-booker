/**
 * app/api/polls/team/route.ts
 *
 * GET  /api/polls/team?pollId=<id>&action=list
 *   → Returns all team members on a poll (poll creator only)
 *
 * POST /api/polls/team
 *   Body: { pollId, collaboratorEmail }
 *   → Looks up the user by email (same lookup /api/whoru performs),
 *     creates a pollCollaborations doc, and fires the poll-team-added
 *     email. Only the poll creator can call this.
 *
 * DELETE /api/polls/team
 *   Body: { collaborationId }
 *   → Deletes a pollCollaborations doc. Either the poll creator (dismiss
 *     a team mate) or the team mate themselves (exit) can call this.
 *
 * Poll teams have exactly one access tier — there's no role/permission
 * selection like the event-team feature (app/api/teams/route.ts). Being
 * on the team grants edit-page access (poll info, schedule, contestants/
 * categories, and the vote-stats-visibility toggle) plus read access to
 * vote stats/entries. It never grants access to the standalone Poll
 * Settings page or to payouts — those stay creator-only regardless of
 * team membership (see app/lib/poll-team-access.ts).
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"

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

// ── Best-effort notification email ──────────────────────────────────────────
// Fire-and-forget by design, same philosophy as app/api/teams/route.ts and
// app/api/payout/vault-notify/route.ts: a failed notification email must
// never surface as a failed "add" to the booker who just performed it.
async function notifyPollTeamAdded(params: {
  pollId: string
  pollName: string
  adderName: string
  recipientName: string
  email: string
}) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/notify/poll-team-added`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      console.warn("[polls/team] poll-team-added notification failed:", await res.text().catch(() => ""))
    }
  } catch (err) {
    console.error("[polls/team] poll-team-added notification error:", err)
  }
}

// ── GET — list team members (poll creator only) ──────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const pollId = searchParams.get("pollId")
  const action = searchParams.get("action") ?? "list"

  if (!pollId?.trim()) return fail("pollId is required", 400)
  if (action !== "list") return fail("Invalid action. Use 'list'.", 400)

  try {
    const pollSnap = await adminDb.collection("voting").doc(pollId).get()
    if (!pollSnap.exists) return fail("Poll not found", 404)

    const d = pollSnap.data()!
    const owner = d.creatorId ?? d.organizerId ?? null
    if (owner !== userId) return fail("Only the poll creator can view the team", 403)

    const snap = await adminDb
      .collection("pollCollaborations")
      .where("pollId", "==", pollId)
      .where("isActive", "==", true)
      .get()

    const members = snap.docs.map((doc) => {
      const c = doc.data()
      return {
        collaborationId:   doc.id,
        collaboratorId:    c.collaboratorId,
        collaboratorEmail: c.collaboratorEmail,
        displayName:       c.displayName ?? c.collaboratorEmail,
        addedAt:           c.addedAt ?? null,
      }
    })

    return ok({ members })
  } catch (e: any) {
    console.error("[GET /api/polls/team]", e)
    return fail("Internal server error", 500)
  }
}

// ── POST — add a poll team member ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try { body = await req.json() } catch { return fail("Invalid JSON body", 400) }

  const { pollId, collaboratorEmail } = body
  if (!pollId?.trim())            return fail("pollId is required", 400)
  if (!collaboratorEmail?.trim()) return fail("collaboratorEmail is required", 400)

  const email = collaboratorEmail.trim().toLowerCase()

  try {
    const pollRef  = adminDb.collection("voting").doc(pollId)
    const pollSnap = await pollRef.get()
    if (!pollSnap.exists) return fail("Poll not found", 404)

    const pollData = pollSnap.data()!
    const owner = pollData.creatorId ?? pollData.organizerId ?? null
    if (owner !== userId) return fail("Only the poll creator can add team members", 403)

    // Same gate as the event-team feature — reuses the profile-level
    // enabledCollaboration flag so bookers manage one on/off switch for
    // collaboration across both events and polls.
    const ownerDoc = await adminDb.collection("users").doc(userId).get()
    if (!ownerDoc.data()?.enabledCollaboration) {
      return fail("You must enable collaboration in your profile settings first", 400)
    }

    // Look up the collaborator by email (same lookup /api/whoru performs).
    const usersSnap = await adminDb
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get()

    if (usersSnap.empty) return fail("No Spotix account found with that email address", 404)

    const collaboratorDoc = usersSnap.docs[0]
    const collaboratorId  = collaboratorDoc.id

    if (collaboratorId === userId) return fail("You cannot add yourself to the poll team", 400)

    const existingSnap = await adminDb
      .collection("pollCollaborations")
      .where("pollId", "==", pollId)
      .where("collaboratorId", "==", collaboratorId)
      .where("isActive", "==", true)
      .limit(1)
      .get()

    if (!existingSnap.empty) return fail("This person is already on this poll's team", 409)

    const recipientName = collaboratorDoc.data()?.fullName || email
    const pollName       = pollData.pollName ?? "your poll"

    const collabRef = await adminDb.collection("pollCollaborations").add({
      pollId,
      collaboratorId,
      collaboratorEmail: email,
      displayName: recipientName,
      ownerId: userId,
      isActive: true,
      addedAt: new Date().toISOString(),
    })

    const adderName = ownerDoc.data()?.fullName || ownerDoc.data()?.email || "A Spotix booker"

    // Awaited so it fires before the serverless function exits — errors
    // are swallowed inside notifyPollTeamAdded itself, so a failed email
    // never turns this into a failed "add".
    await notifyPollTeamAdded({
      pollId,
      pollName,
      adderName,
      recipientName,
      email,
    })

    return ok({
      message: "Team member added successfully",
      collaborationId: collabRef.id,
      collaboratorId,
      displayName: recipientName,
      collaboratorEmail: email,
    }, 201)
  } catch (e: any) {
    console.error("[POST /api/polls/team]", e)
    return fail("Internal server error", 500)
  }
}

// ── DELETE — dismiss a team member or self-exit ───────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try { body = await req.json() } catch { return fail("Invalid JSON body", 400) }

  const { collaborationId } = body
  if (!collaborationId?.trim()) return fail("collaborationId is required", 400)

  try {
    const collabRef  = adminDb.collection("pollCollaborations").doc(collaborationId)
    const collabSnap = await collabRef.get()
    if (!collabSnap.exists) return fail("Team membership not found", 404)

    const collab = collabSnap.data()!
    const isOwner        = collab.ownerId === userId
    const isCollaborator = collab.collaboratorId === userId

    if (!isOwner && !isCollaborator) {
      return fail("You do not have permission to remove this team member", 403)
    }

    await collabRef.delete()

    return ok({ message: isCollaborator ? "You have exited the poll team" : "Team member removed successfully" })
  } catch (e: any) {
    console.error("[DELETE /api/polls/team]", e)
    return fail("Internal server error", 500)
  }
}
