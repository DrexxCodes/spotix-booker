import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

// NOTE: Flat structure — events/{eventId}/responses — matching where
// spotix-backend/v1/lib/ticket/survey-delivery.js actually writes buyer
// responses (post-payment) and where spotix-user's legacy
// app/api/v1/survey/response/route.ts read/wrote. Previously this read
// from events/{userId}/userEvents/{eventId}/responses, a path nothing
// else in the system ever wrote to, so the booker dashboard would always
// show zero responses even after buyers completed the form and paid.
//
// The POST handler is kept for completeness/back-compat but is no longer
// the path buyer responses take — see survey-delivery.js.

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
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const eventId = searchParams.get("eventId")

    if (!userId || !eventId) {
      return NextResponse.json({ error: "Missing required parameters: userId, eventId" }, { status: 400 })
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
