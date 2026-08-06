/**
 * app/api/event/one/route.ts
 *
 * POST /api/event/one — Create a new event (authenticated bookers only)
 *
 * ── Auth discrepancy fixed ─────────────────────────────────────────────────────
 * This route previously read identity via a bespoke `resolveIdentity()` that:
 *   1. Checked `x-user-id`/`x-user-is-booker` request headers first — dead code.
 *      proxy.ts's matcher explicitly excludes `/api/*`, so those headers are
 *      never injected on API requests; only page navigations get them.
 *   2. Read the access token off `request.cookies` (NextRequest's cookie jar)
 *      instead of the `cookies()` helper from `next/headers` that every other
 *      route in this app (teams, event/list/[eventId], payout, payout/vault,
 *      payout/method, ...) uses.
 *   3. Imported `COOKIE_ACCESS_TOKEN` from `@/api/auth/route` — the ONLY
 *      cross-import of a Route Handler module anywhere in this codebase.
 *      `route.ts` files are only supposed to export HTTP method handlers and
 *      the segment config (`runtime`, `dynamic`, etc.); pulling in a stray
 *      named export drags in that whole module's dependency graph and isn't
 *      something Next.js's route module loader is built to support cleanly.
 *
 * None of that is what was actually causing "you must be logged in" for an
 * already-logged-in user, though — it's just legacy drift worth cleaning up.
 * The real cause: the auth flow was updated app-wide to hold the access token
 * in memory and attach it as an `Authorization: Bearer` header via
 * `authFetch()` (see lib/auth-client.ts), with the `spotix_at` cookie kept in
 * sync alongside it. Every other authenticated page in the app was migrated
 * to call its APIs through `authFetch()`. The one-time event creation form
 * (app/components/create-event/create-one-time-event.tsx) was missed — it
 * was still calling this endpoint with a plain `fetch()`. That meant:
 *   - No Authorization header was ever sent (this route did support Bearer,
 *     it just never received one from this particular caller).
 *   - No silent-refresh-and-retry on 401 — the auto-refresh authFetch()
 *     provides for every other call was never triggered here.
 * Filling out the multi-step create-event form easily takes longer than the
 * access token's 15-minute TTL, so the `spotix_at` cookie would go stale
 * mid-form with nothing to refresh it, and submitting would 401 even though
 * the user's session (refresh token) was still completely valid. Fixed on
 * the client by switching that call to `authFetch()`.
 *
 * Changes from previous version:
 *  - Step 6: After writing the event, atomically increments totalEvents on
 *    users/{organizerId} so the revenue/dashboard API can read it directly.
 *  - Status field now supports "active" | "inactive" | "cancelled" | "completed"
 *    (was "active" | "cancelled" | "completed"). New events still default to "active".
 *
 * ── Firestore composite indexes required ──────────────────────────────────────
 *   Collection : events  |  Fields : organizerId ASC, createdAt DESC
 *   Collection : events  |  Fields : organizerId ASC, status ASC
 *   Collection : events  |  Fields : status ASC, eventDate ASC
 *   Collection : forecasts | Fields : status ASC, eventDate ASC
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAccessToken } from "@/lib/auth-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEV_TAG = "API developed and maintained by Spotix Technologies";

function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json({ ...data, developer: DEV_TAG }, { status });
}
function err(error: string, message: string, status: number, details?: string) {
  return NextResponse.json(
    { error, message, ...(details ? { details } : {}), developer: DEV_TAG },
    { status }
  );
}

interface TicketType {
  policy: string;
  price: number | string;
  quantity?: number;
}

// ── Auth — matches the pattern used everywhere else in the app ───────────────
// (app/api/teams/route.ts, app/api/event/list/[eventId]/route.ts,
//  app/api/payout/route.ts, etc.) Cookie first (the common case — every page
// load carries it), Authorization Bearer as a fallback for authFetch()'s
// in-memory-token calls, which matters here specifically because this
// endpoint is reached from a long-running multi-step form.
async function resolveIdentity(
  request: NextRequest
): Promise<{ uid: string; isBooker: boolean } | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("spotix_at")?.value;
  const bearerToken = request.headers.get("Authorization")?.replace("Bearer ", "");
  const token = cookieToken || bearerToken;
  if (!token) return null;

  try {
    const payload = await verifyAccessToken(token, "spotix-booker");
    return { uid: payload.uid, isBooker: payload.isBooker };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const identity = await resolveIdentity(request);
  if (!identity) return err("Unauthorized", "You must be logged in to create events", 401);
  if (!identity.isBooker) return err("Forbidden", "Only booker accounts can create events", 403);
  const organizerId = identity.uid;

  // ── 2. Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return err("Bad Request", "Invalid JSON in request body", 400);
  }

  const {
    eventName, eventDescription, eventImages, eventDate, eventVenue,
    venueCoordinates = null, eventStart, eventEnd, eventEndDate, eventType,
    enablePricing, ticketPrices = [], enableStopDate = false, stopDate = null,
    enabledCollaboration = false, allowAgents = false,
    affiliateId = null, affiliateName = null,
  } = body;

  // ── 3. Validation ────────────────────────────────────────────────────────────
  if (!eventName?.trim()) return err("Bad Request", "eventName is required", 400);
  if (!eventDescription?.trim()) return err("Bad Request", "eventDescription is required", 400);
  if (!eventDate?.trim()) return err("Bad Request", "eventDate is required", 400);
  if (!eventVenue?.trim()) return err("Bad Request", "eventVenue is required", 400);
  if (!eventStart?.trim() || !eventEnd?.trim() || !eventEndDate?.trim()) {
    return err("Bad Request", "eventStart, eventEnd, and eventEndDate are all required", 400);
  }
  if (!eventType?.trim()) return err("Bad Request", "eventType is required", 400);
  if (!Array.isArray(eventImages) || eventImages.length === 0) {
    return err("Bad Request", "At least one event image is required", 400);
  }
  if (
    venueCoordinates !== null && venueCoordinates !== undefined &&
    (typeof venueCoordinates.lat !== "number" || typeof venueCoordinates.lng !== "number")
  ) {
    return err("Bad Request", "venueCoordinates must be an object with numeric lat and lng fields", 400);
  }
  if (enablePricing) {
    if (!Array.isArray(ticketPrices) || ticketPrices.length === 0) {
      return err("Bad Request", "ticketPrices are required when enablePricing is true", 400);
    }
    for (let i = 0; i < ticketPrices.length; i++) {
      const ticket: TicketType = ticketPrices[i];
      if (!ticket.policy?.trim()) return err("Bad Request", `Ticket at index ${i} is missing a policy name`, 400);
      if (ticket.price === undefined || ticket.price === null || ticket.price === "") {
        return err("Bad Request", `Ticket "${ticket.policy}" is missing a price`, 400);
      }
      const numericPrice = Number(ticket.price);
      if (isNaN(numericPrice) || numericPrice < 0) {
        return err("Bad Request", `Ticket "${ticket.policy}" has an invalid price`, 400);
      }
    }
  }

  // ── 4. Build event document ──────────────────────────────────────────────────
  const [primaryImage, ...additionalImages] = eventImages as string[];
  const isFree = !enablePricing;

  const eventDoc: Record<string, any> = {
    organizerId,
    eventName: eventName.trim(),
    eventDescription: eventDescription.trim(),
    eventImage: primaryImage,
    eventImages: additionalImages,
    eventDate, eventEndDate, eventStart, eventEnd,
    eventVenue: eventVenue.trim(),
    venueCoordinates: venueCoordinates ?? null,
    eventType, isFree,
    ticketPrices: enablePricing ? ticketPrices : [],
    enabledCollaboration,
    allowAgents: enabledCollaboration ? allowAgents : false,
    affiliateId: affiliateId ?? null,
    affiliateName: affiliateName ?? null,
    status: "active",   // new events are always active
    ticketsSold: 0,
    revenue: 0,
    hasStopDate: enableStopDate && !!stopDate,
    stopDate: enableStopDate && stopDate ? new Date(stopDate) : null,
    createdAt: FieldValue.serverTimestamp(),
  };

  // ── 5. Write event to Firestore ──────────────────────────────────────────────
  const warnings: string[] = [];
  let eventId: string;

  try {
    const docRef = await adminDb.collection("events").add(eventDoc);
    eventId = docRef.id;
  } catch (firestoreErr: any) {
    console.error("Firestore event write failed:", firestoreErr);
    let message = "Unable to create event. Please try again.";
    if (firestoreErr.code === "permission-denied") message = "Permission denied — check Firestore security rules";
    else if (firestoreErr.code === "unavailable") message = "Firestore is temporarily unavailable. Please retry.";
    return err("Event Creation Failed", message, 500, firestoreErr.message);
  }

  // ── 6. Increment totalEvents on the organizer's user document ────────────────
  /**
   * users/{organizerId}.totalEvents is the authoritative counter read by the
   * revenue/dashboard API. Incrementing here keeps it in sync without requiring
   * a full events collection scan on every dashboard load.
   *
   * Non-fatal — if this fails the event still exists and the dashboard falls
   * back gracefully. An admin can repair the counter manually if needed.
   */
  try {
    await adminDb
      .collection("users")
      .doc(organizerId)
      .update({ totalEvents: FieldValue.increment(1) });
  } catch (counterErr: any) {
    console.error("totalEvents counter increment failed for user", organizerId, counterErr);
    warnings.push("User event counter could not be updated — dashboard total may be temporarily stale");
  }

  // ── 7. Seed forecast document ────────────────────────────────────────────────
  try {
    const city = venueCoordinates
      ? eventVenue.trim().split(",").pop()?.trim() ?? eventVenue.trim()
      : eventVenue.trim();

    await adminDb.collection("forecasts").doc(eventId).set({
      eventId, eventDate,
      eventLocation: { lat: venueCoordinates?.lat ?? null, lng: venueCoordinates?.lng ?? null, city },
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (forecastErr: any) {
    console.error("Forecast seed failed for eventId", eventId, forecastErr);
    warnings.push("Weather forecast could not be initialised for this event");
  }

  // ── 8. Affiliate relationship ────────────────────────────────────────────────
  if (affiliateId) {
    try {
      const batch = adminDb.batch();
      batch.set(
        adminDb.collection("Affiliates").doc(affiliateId).collection("affiliatedEvents").doc(eventId),
        { organizerId, eventId, eventName: eventDoc.eventName, createdAt: FieldValue.serverTimestamp() }
      );
      batch.update(adminDb.collection("Affiliates").doc(affiliateId), {
        eventCount: FieldValue.increment(1),
      });
      await batch.commit();
    } catch (affiliateErr: any) {
      console.error("Affiliate relationship failed:", affiliateErr);
      warnings.push("Affiliate relationship could not be created");
    }
  }

  // ── 9. Analytics ─────────────────────────────────────────────────────────────
  try {
    const watFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
    });
    const parts = watFormatter.formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const year = get("year");
    const month = `${year}-${get("month")}`;
    const day = `${month}-${get("day")}`;

    const analyticsPayload = {
      [isFree ? "freeEvents" : "paidEvents"]: FieldValue.increment(1),
      totalEvents: FieldValue.increment(1),
      lastUpdated: FieldValue.serverTimestamp(),
    };

    const analyticsBatch = adminDb.batch();
    const base = adminDb.collection("admin").doc("analytics");
    analyticsBatch.set(base.collection("daily").doc(day), analyticsPayload, { merge: true });
    analyticsBatch.set(base.collection("monthly").doc(month), analyticsPayload, { merge: true });
    analyticsBatch.set(base.collection("yearly").doc(year), analyticsPayload, { merge: true });
    await analyticsBatch.commit();
  } catch (analyticsErr) {
    console.error("Analytics update failed:", analyticsErr);
    warnings.push("Analytics could not be updated");
  }

  // ── 10. Success ──────────────────────────────────────────────────────────────
  return ok(
    {
      success: true,
      message: "Event created successfully",
      eventId,
      data: {
        eventName: eventDoc.eventName, eventType, isFree, eventDate,
        eventVenue: eventDoc.eventVenue,
        ticketTypesCount: enablePricing ? ticketPrices.length : 0,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    },
    201
  );
}