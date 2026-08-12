/**
 * app/api/polls/team/route.ts
 *
 * GET  /api/polls/team?pollId=<id>&action=list
 *   → Returns all team members on a poll. The creator or any active team
 *     member can call this (a member needs it to render their own Team
 *     panel on the Settings page).
 *
 * POST /api/polls/team
 *   Body: { pollId, collaboratorEmail }
 *   → Looks up the user by email (same lookup /api/whoru performs),
 *     creates a pollCollaborations doc, and fires the poll-team-added
 *     email. Callable by the poll creator, or by an active team member
 *     who has been granted the canAddAdmin privilege (see PATCH below).
 *
 * PATCH /api/polls/team
 *   Body: { collaborationId, canAddAdmin }
 *   → Grants or revokes a team member's ability to add further team
 *     members. Poll-creator-only — a member can never change this for
 *     themselves or anyone else, even one with canAddAdmin already.
 *
 * DELETE /api/polls/team
 *   Body: { collaborationId }
 *   → Deletes a pollCollaborations doc. Either the poll creator (dismiss
 *     a team mate) or the team mate themselves (exit) can call this.
 *
 * Poll teams have exactly one access tier plus a single opt-in privilege
 * flag (canAddAdmin) — there's no full role/permission matrix like the
 * event-team feature (app/api/teams/route.ts). Being on the team grants
 * the same read/edit surface as the creator — command center, edit page,
 * vote stats/entries, and the standalone Poll Settings page — MINUS
 * initiating a payout (creator-only, always) and MINUS adding new team
 * members (creator, or a member with canAddAdmin). See
 * app/lib/poll-team-access.ts for the full breakdown.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { resolvePollAccess } from "@/lib/poll-team-access"

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

// ── GET — list team members (creator or any active team member) ──────────────
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
    const access = await resolvePollAccess(pollId, userId)
    if (!access.ok) return fail(access.error, access.status)

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
        canAddAdmin:       c.canAddAdmin === true,
        isYou:             c.collaboratorId === userId,
      }
    })

    // role/canAddAdmin describe the requester themselves — lets the Settings
    // page gate the "Add" button and the canAddAdmin toggle without a
    // second round trip.
    return ok({ members, role: access.role, canAddAdmin: access.canAddAdmin })
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
    const access = await resolvePollAccess(pollId, userId)
    if (!access.ok) return fail(access.error, access.status)

    // Owner can always add; a member needs the canAddAdmin privilege the
    // creator granted them (see PATCH below) — a member never grants it
    // to themselves, since resolvePollAccess reads canAddAdmin straight
    // off their own pollCollaborations doc.
    if (access.role === "member" && !access.canAddAdmin) {
      return fail("You don't have permission to add team members on this poll. Ask the poll creator to grant you that privilege.", 403)
    }

    const pollData = access.pollSnap.data()!
    const owner    = access.ownerId

    // Same gate as the event-team feature — reuses the profile-level
    // enabledCollaboration flag on the poll OWNER's account, since
    // collaboration is a feature of the owner's poll regardless of which
    // team member (owner or canAddAdmin member) is doing the adding.
    const ownerDoc = await adminDb.collection("users").doc(owner).get()
    if (!ownerDoc.data()?.enabledCollaboration) {
      return fail("The poll creator must enable collaboration in their profile settings first", 400)
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
      // Always the poll's true creator — not necessarily the requester,
      // since a member with canAddAdmin can also call this endpoint. The
      // creator (and only the creator) needs to be able to dismiss anyone
      // added this way, so DELETE's isOwner check must resolve correctly
      // regardless of who did the adding.
      ownerId: owner,
      // New team members can't add further team members until the creator
      // explicitly grants it (see PATCH below).
      canAddAdmin: false,
      isActive: true,
      addedAt: new Date().toISOString(),
    })

    // The person who actually performed the add — the owner themselves, or
    // a canAddAdmin member acting on their behalf.
    const requesterDoc = userId === owner ? ownerDoc : await adminDb.collection("users").doc(userId).get()
    const adderName = requesterDoc.data()?.fullName || requesterDoc.data()?.email || "A Spotix booker"

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

// ── PATCH — grant/revoke a member's canAddAdmin privilege (creator-only) ──────
export async function PATCH(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try { body = await req.json() } catch { return fail("Invalid JSON body", 400) }

  const { collaborationId, canAddAdmin } = body
  if (!collaborationId?.trim())    return fail("collaborationId is required", 400)
  if (typeof canAddAdmin !== "boolean") return fail("canAddAdmin must be a boolean", 400)

  try {
    const collabRef  = adminDb.collection("pollCollaborations").doc(collaborationId)
    const collabSnap = await collabRef.get()
    if (!collabSnap.exists) return fail("Team membership not found", 404)

    const collab = collabSnap.data()!

    // Only the poll's true creator can grant or revoke this — a member with
    // canAddAdmin cannot extend that privilege to anyone else, themselves
    // included, closing off any privilege-escalation path through POST.
    if (collab.ownerId !== userId) {
      return fail("Only the poll creator can change this privilege", 403)
    }

    await collabRef.update({ canAddAdmin })

    return ok({
      message: canAddAdmin ? "Team member can now add teammates" : "Team member can no longer add teammates",
      collaborationId,
      canAddAdmin,
    })
  } catch (e: any) {
    console.error("[PATCH /api/polls/team]", e)
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
