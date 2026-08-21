/**
 * app/api/event/list/[eventId]/route.ts
 *
 * GET    /api/event/list/[eventId]
 *   → Returns full event detail: eventData, attendees, discounts, payouts,
 *     chart data, bookerBVT, and weather forecast.
 *
 * PATCH  /api/event/list/[eventId]
 *   Body { action: "edit", ...editFields }      → Update core event fields
 *   Body { action: "toggleDiscount", code }     → Flip discount active flag
 *
 * POST   /api/event/list/[eventId]
 *   Body { action: "addDiscount", ...discount } → Add a new discount code
 *
 * All handlers:
 *   - Auth via spotix_at httpOnly cookie
 *   - Ownership enforced: authenticated user must be the event organizer
 *   - Admin SDK only — no client SDK
 *
 * Flat Firestore structure:
 *   events/{eventId}
 *   events/{eventId}/attendees
 *   events/{eventId}/discounts
 *   events/{eventId}/payouts
 *   users/{organizerId}
 *   forecasts/{eventId}
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { FieldValue } from "firebase-admin/firestore"
import { resolveEventAccess, isOwnerOrAdmin, EventAccessResult } from "@/lib/event-access"
import { buildEventBundle } from "@/lib/event-bundle"

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

// ─── Auth ─────────────────────────────────────────────────────────────────────
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

// ─── Ownership guard (STRICT — Creator only) ─────────────────────────────────
// Kept for the "edit" action specifically: Admin gets full-parity access
// to everything else on this route, but editing the event's core fields
// stays Creator-only (see BUILT_IN_ROLE_TABS.admin in lib/team-tabs.ts —
// "edit" is deliberately excluded from Admin's tab list).
async function resolveOwnedEvent(
  eventId: string,
  userId: string
): Promise<
  | { snap: FirebaseFirestore.DocumentSnapshot; ref: FirebaseFirestore.DocumentReference }
  | NextResponse
> {
  const ref = adminDb.collection("events").doc(eventId)
  const snap = await ref.get()
  if (!snap.exists) return fail("Event not found", 404)
  if (snap.data()!.organizerId !== userId) return fail("Forbidden: you do not own this event", 403)
  return { snap, ref }
}

// ─── Full-parity guard (Creator OR Admin) ────────────────────────────────────
// Used by GET (the full dashboard bundle) and every mutation that Admin is
// allowed to perform. Other collaborator roles (checkin/accountant/custom)
// keep using GET /api/teams?action=myAccess for their (tab-scoped) view —
// see app/api/teams/route.ts.
async function resolveParityAccess(
  eventId: string,
  userId: string
): Promise<Extract<EventAccessResult, { ok: true }> | NextResponse> {
  const access = await resolveEventAccess(eventId, userId)
  if (!access.ok) return fail(access.error, access.status)
  if (!isOwnerOrAdmin(access)) {
    return fail("Forbidden: use /api/teams?action=myAccess for your role's view of this event", 403)
  }
  return access
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { eventId } = await params
  if (!eventId?.trim()) return fail("eventId is required", 400)

  // Creator OR Admin — full parity bundle either way. Other collaborator
  // roles are routed to /api/teams?action=myAccess by the client when this
  // 403s (see loadPage() in app/event-info/[eventId]/page.tsx).
  const access = await resolveParityAccess(eventId, userId)
  if (access instanceof NextResponse) return access

  const bundle = await buildEventBundle(access.eventRef, access.eventSnap, access.organizerId)

  // Note: forecast is intentionally excluded here.
  // WeatherTab fetches /api/forecast on demand when the tab is selected.

  return ok(bundle)
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
// action: "edit"           → update core event fields
// action: "toggleDiscount" → flip active flag on a discount doc by code
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { eventId } = await params
  if (!eventId?.trim()) return fail("eventId is required", 400)

  let body: Record<string, any>
  try { body = await req.json() } catch { return fail("Invalid JSON body", 400) }

  const { action } = body
  if (!action) return fail("action is required", 400)

  // "edit" stays Creator-only (Admin's tab list excludes "edit" — see
  // lib/team-tabs.ts). Every other action here is full-parity (Creator or
  // Admin), resolved just below inside each action branch.
  if (action === "edit") {
    const owned = await resolveOwnedEvent(eventId, userId)
    if (owned instanceof NextResponse) return owned
    const { ref: eventRef } = owned

    const {
      eventName, eventDescription, eventDate, eventEndDate,
      eventVenue, eventStart, eventEnd, eventType,
      enablePricing, ticketPrices,
      enableStopDate, stopDate,
      enableColorCode, colorCode,
      enableMaxSize, maxSize,
    } = body

    if (!eventName?.trim())       return fail("eventName is required", 400)
    if (!eventDescription?.trim()) return fail("eventDescription is required", 400)
    if (!eventDate?.trim())       return fail("eventDate is required", 400)
    if (!eventVenue?.trim())      return fail("eventVenue is required", 400)
    if (!eventStart?.trim() || !eventEnd?.trim() || !eventEndDate?.trim()) {
      return fail("eventStart, eventEnd, and eventEndDate are required", 400)
    }
    if (!eventType?.trim()) return fail("eventType is required", 400)

    const updateData: Record<string, any> = {
      eventName: eventName.trim(),
      eventDescription: eventDescription.trim(),
      eventDate,
      eventEndDate,
      eventVenue: eventVenue.trim(),
      eventStart,
      eventEnd,
      eventType,
      isFree: !enablePricing,
      ticketPrices: enablePricing ? (ticketPrices ?? []) : [],
      enableStopDate: !!enableStopDate,
      stopDate: enableStopDate && stopDate ? new Date(stopDate) : null,
      enableColorCode: !!enableColorCode,
      colorCode: enableColorCode ? (colorCode ?? null) : null,
      enableMaxSize: !!enableMaxSize,
      maxSize: enableMaxSize ? (maxSize ?? null) : null,
      updatedAt: FieldValue.serverTimestamp(),
    }

    try {
      await eventRef.update(updateData)
      return ok({ message: "Event updated successfully" })
    } catch (e: any) {
      console.error("[PATCH edit] Firestore update failed", e)
      return fail("Failed to update event", 500)
    }
  }

  // Every remaining action (apiAccess, toggleAgentActivity, setAgentIncentive,
  // toggleDiscount) is full-parity — Creator or Admin.
  const access = await resolveParityAccess(eventId, userId)
  if (access instanceof NextResponse) return access
  const eventRef = access.eventRef

  // -- action: apiAccess ---------------------------------------------------
  // Toggles allowAPIAccess and sets widget display options for this event.
  // Consumed by app/components/event-info/apiAccess.tsx. Location and event
  // dates remain read-only regardless of this setting -- this only gates
  // /v1/event, /v1/event/stats, /v1/widget, /v1/lookup in spotix-api.
  if (action === "apiAccess") {
    const { allowAPIAccess, widgetLength, widgetHeight, widgetColour } = body

    const update: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() }

    if (allowAPIAccess !== undefined) update.allowAPIAccess = Boolean(allowAPIAccess)

    if (widgetLength !== undefined) {
      const n = Number(widgetLength)
      if (!Number.isFinite(n) || n < 120 || n > 800) return fail("widgetLength must be between 120 and 800", 400)
      update.widgetLength = n
    }
    if (widgetHeight !== undefined) {
      const n = Number(widgetHeight)
      if (!Number.isFinite(n) || n < 120 || n > 800) return fail("widgetHeight must be between 120 and 800", 400)
      update.widgetHeight = n
    }
    if (widgetColour !== undefined) {
      if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(widgetColour)) return fail("widgetColour must be a valid hex colour", 400)
      update.widgetColour = widgetColour
    }

    try {
      await eventRef.update(update)
      return ok({ message: "API & widget settings updated" })
    } catch (e: any) {
      console.error("[PATCH apiAccess] failed", e)
      return fail("Failed to update API access settings", 500)
    }
  }

  // -- action: toggleAgentActivity --------------------------------------------
  // Instruction 5: bookers toggle this live from the event-info Teams tab,
  // independent of the create-event-time enabledCollaboration/allowAgents
  // pairing. Events with agent activity disabled block all agent-side
  // actions -- the agent app re-checks `allowAgents` on the event doc
  // before letting an agent affiliate or sell.
  //
  // Incentives are event-wide, not per-agent (every agent selling for this
  // event earns the same rate) — so turning agent activity ON requires one
  // to already be set. Body: { agentIncentive: { type, value } } is required
  // only on the ON transition; turning OFF doesn't touch it, so re-enabling
  // later remembers the last value as a convenience.
  if (action === "toggleAgentActivity") {
    const currentValue = access.eventSnap.data()!.allowAgents === true
    const turningOn = !currentValue

    if (turningOn) {
      const { agentIncentive } = body
      const invalid =
        !agentIncentive ||
        (agentIncentive.type !== "percentage" && agentIncentive.type !== "flat") ||
        !Number.isFinite(Number(agentIncentive.value)) ||
        Number(agentIncentive.value) < 0 ||
        (agentIncentive.type === "percentage" && Number(agentIncentive.value) > 100)
      if (invalid) {
        return fail("Set a valid incentive before enabling agent activity — agents can't apply without one", 400)
      }
      try {
        await eventRef.update({
          allowAgents: true,
          agentIncentive: { type: agentIncentive.type, value: Number(agentIncentive.value) },
          updatedAt: FieldValue.serverTimestamp(),
        })
        return ok({
          message: "Agent activity enabled",
          allowAgents: true,
          agentIncentive: { type: agentIncentive.type, value: Number(agentIncentive.value) },
        })
      } catch (e: any) {
        console.error("[PATCH toggleAgentActivity] failed", e)
        return fail("Failed to update agent activity", 500)
      }
    }

    try {
      await eventRef.update({ allowAgents: false, updatedAt: FieldValue.serverTimestamp() })
      return ok({ message: "Agent activity disabled", allowAgents: false })
    } catch (e: any) {
      console.error("[PATCH toggleAgentActivity] failed", e)
      return fail("Failed to update agent activity", 500)
    }
  }

  // -- action: setAgentIncentive ------------------------------------------------
  // Lets the booker adjust the event-wide incentive rate without re-toggling
  // agent activity off and back on. Applies to every agent on this event.
  if (action === "setAgentIncentive") {
    const { agentIncentive } = body
    const invalid =
      !agentIncentive ||
      (agentIncentive.type !== "percentage" && agentIncentive.type !== "flat") ||
      !Number.isFinite(Number(agentIncentive.value)) ||
      Number(agentIncentive.value) < 0 ||
      (agentIncentive.type === "percentage" && Number(agentIncentive.value) > 100)
    if (invalid) return fail("Provide a valid incentive: { type: 'percentage' | 'flat', value }", 400)

    try {
      const value = { type: agentIncentive.type, value: Number(agentIncentive.value) }
      await eventRef.update({ agentIncentive: value, updatedAt: FieldValue.serverTimestamp() })
      return ok({ message: "Incentive updated", agentIncentive: value })
    } catch (e: any) {
      console.error("[PATCH setAgentIncentive] failed", e)
      return fail("Failed to update incentive", 500)
    }
  }

  if (action === "toggleDiscount") {
    const { discountId } = body
    if (!discountId) return fail("discountId is required", 400)

    const discountRef = eventRef.collection("discounts").doc(discountId)
    const discountSnap = await discountRef.get()

    if (!discountSnap.exists) return fail("Discount not found", 404)

    const currentActive = discountSnap.data()!.active !== false
    try {
      await discountRef.update({ active: !currentActive })
      return ok({ message: "Discount status updated", active: !currentActive })
    } catch (e: any) {
      console.error("[PATCH toggleDiscount] failed", e)
      return fail("Failed to update discount", 500)
    }
  }

  return fail(`Unknown action: ${action}`, 400)
}

// ─── POST ─────────────────────────────────────────────────────────────────────
// action: "addDiscount" → create a new discount doc
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { eventId } = await params
  if (!eventId?.trim()) return fail("eventId is required", 400)

  let body: Record<string, any>
  try { body = await req.json() } catch { return fail("Invalid JSON body", 400) }

  const { action } = body
  if (action !== "addDiscount") return fail(`Unknown action: ${action}`, 400)

  const access = await resolveParityAccess(eventId, userId)
  if (access instanceof NextResponse) return access
  const eventRef = access.eventRef

  const { code, type, value, maxUses, usedCount, active } = body

  if (!code?.trim()) return fail("code is required", 400)
  if (!["percentage", "flat"].includes(type)) return fail("type must be 'percentage' or 'flat'", 400)
  if (typeof value !== "number" || value < 0) return fail("value must be a non-negative number", 400)

  // Check for duplicate code (case-insensitive)
  const existing = await eventRef
    .collection("discounts")
    .where("code", "==", code.trim().toUpperCase())
    .limit(1)
    .get()

  // Also check lowercase/mixed — normalise before comparing
  const existingAll = await eventRef.collection("discounts").get()
  const duplicate = existingAll.docs.some(
    (d) => d.data().code?.toLowerCase() === code.trim().toLowerCase()
  )
  if (duplicate) return fail("A discount with this code already exists", 409)

  const discountDoc = {
    code: code.trim(),
    type,
    value,
    maxUses: maxUses ?? 1,
    usedCount: usedCount ?? 0,
    active: active !== false,
    createdAt: FieldValue.serverTimestamp(),
  }

  try {
    const docRef = await eventRef.collection("discounts").add(discountDoc)
    return ok(
      {
        message: "Discount added successfully",
        discount: { id: docRef.id, ...discountDoc, createdAt: undefined },
      },
      201
    )
  } catch (e: any) {
    console.error("[POST addDiscount] failed", e)
    return fail("Failed to add discount", 500)
  }
}
