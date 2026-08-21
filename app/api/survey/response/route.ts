import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { resolveEventAccess, hasTab } from "@/lib/event-access"

// NOTE: Flat structure — events/{eventId}/responses — matching where
// spotix-backend/v1/lib/ticket/survey-delivery.js actually writes buyer
// responses (post-payment) and where spotix-user's legacy
// app/api/v1/survey/response/route.ts read/wrote. Previously this read
// from events/{userId}/userEvents/{eventId}/responses, a path nothing
// else in the system ever wrote to, so the booker dashboard would always
// show zero responses even after buyers completed the form and paid.
//
// The POST handler is kept for completeness/back-compat but is no longer
// the path buyer responses take — see survey-delivery.js. It is
// deliberately left UNAUTHENTICATED: buyers submitting a form aren't
// booker-side session holders, so it can't require a spotix_at cookie —
// same posture as before. GET (reading buyer PII) is the endpoint that
// actually needed locking down, and now is.

const DEV_TAG = "spotix-api-v1"

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, eventId, responses, attendeeInfo } = body

    if (!userId || !eventId) {
      return NextResponse.json({ error: "Missing required fields: userId, eventId" }, { status: 400 })
    }

    if (!responses || typeof responses !== "object") {
      return NextResponse.json({ error: "Responses must be an object" }, { status: 400 })
    }

    // Store response — flat structure
    const responsesCollectionRef = adminDb
      .collection("events")
      .doc(eventId)
      .collection("responses")

    const responseData = {
      responses,
      attendeeInfo: attendeeInfo || {},
      submittedAt: new Date().toISOString(),
      timestamp: new Date(),
    }

    const docRef = await responsesCollectionRef.add(responseData)

    return NextResponse.json({
      success: true,
      message: "Response saved successfully",
      responseId: docRef.id,
    })
  } catch (error) {
    console.error("Error saving response:", error)
    return NextResponse.json({ error: "Failed to save response" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate()
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("eventId")

    if (!eventId) {
      return fail("Missing required parameter: eventId", 400)
    }

    const access = await resolveEventAccess(eventId, auth.userId)
    if (!access.ok) return fail(access.error, access.status)
    if (!hasTab(access, "responses")) {
      return fail("Forbidden: your role does not have access to Responses on this event", 403)
    }

    // Get all responses — flat structure
    const responsesCollectionRef = adminDb
      .collection("events")
      .doc(eventId)
      .collection("responses")

    const responsesSnapshot = await responsesCollectionRef.orderBy("timestamp", "desc").get()
    const responses = responsesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Get questions for reference — flat structure
    const questionsCollectionRef = adminDb
      .collection("events")
      .doc(eventId)
      .collection("questions")

    const questionsSnapshot = await questionsCollectionRef.orderBy("order").get()
    const questions = questionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    return NextResponse.json({
      success: true,
      responses,
      questions,
      totalResponses: responses.length,
    })
  } catch (error) {
    console.error("Error fetching responses:", error)
    return NextResponse.json({ error: "Failed to fetch responses" }, { status: 500 })
  }
}
