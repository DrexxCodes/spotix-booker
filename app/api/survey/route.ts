import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { resolveEventAccess, hasTab } from "@/lib/event-access"

// NOTE: Firestore paths here are FLAT — events/{eventId}/questions and
// events/{eventId}/formSettings/ticketSettings — matching the structure
// spotix-user's app/api/v1/survey/route.ts reads from, and the structure
// the rest of the Spotix codebase uses (events/{eventId}/...).
//
// This used to write to the legacy nested path
// events/{userId}/userEvents/{eventId}/questions, which meant forms saved
// here were invisible to the buyer-facing app: it was reading from a
// completely different Firestore location. `userId` is kept as a required
// param (the caller still sends it, and it's useful for future ownership
// checks) but it is no longer part of the storage path.
//
// SECURITY: this route previously trusted the `userId`/`eventId` params
// as-is with no session check at all — any caller who knew (or guessed)
// an eventId could read, overwrite, or delete another organizer's form.
// Every handler below now authenticates via the spotix_at cookie and
// resolves real access through resolveEventAccess(), gated on the "form"
// tab (see app/lib/team-tabs.ts). The `userId` query/body param is no
// longer trusted for authorization — the session's own uid is used.

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

// Creator, Admin, or any collaborator (built-in or custom) granted the
// "form" tab.
async function resolveFormAccess(eventId: string, userId: string) {
  const access = await resolveEventAccess(eventId, userId)
  if (!access.ok) return fail(access.error, access.status)
  if (!hasTab(access, "form")) {
    return fail("Forbidden: your role does not have access to the Form on this event", 403)
  }
  return access
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate()
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { eventId, questions, ticketSettings } = body

    if (!eventId) {
      return fail("Missing required field: eventId", 400)
    }

    const access = await resolveFormAccess(eventId, auth.userId)
    if (access instanceof NextResponse) return access

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: "Questions must be an array" }, { status: 400 })
    }

    // Validate question structure
    for (const question of questions) {
      if (!question.questionText || !question.questionType) {
        return NextResponse.json(
          { error: "Each question must have questionText and questionType" },
          { status: 400 },
        )
      }

      const validTypes = ["short", "long", "number", "radio", "checkbox", "phone", "date", "time", "datetime"]
      if (!validTypes.includes(question.questionType)) {
        return NextResponse.json(
          { error: `Invalid question type. Must be one of: ${validTypes.join(", ")}` },
          { status: 400 },
        )
      }

      if ((question.questionType === "radio" || question.questionType === "checkbox") && !question.options?.length) {
        return NextResponse.json(
          { error: `Questions of type ${question.questionType} must have options` },
          { status: 400 },
        )
      }
    }

    // Store each question as a separate document — flat structure
    const questionsCollectionRef = adminDb
      .collection("events")
      .doc(eventId)
      .collection("questions")

    // Delete existing questions first
    const existingQuestions = await questionsCollectionRef.get()
    const batch = adminDb.batch()
    existingQuestions.docs.forEach((doc) => {
      batch.delete(doc.ref)
    })
    await batch.commit()

    // Add new questions
    const questionIds: string[] = []
    for (let i = 0; i < questions.length; i++) {
      const questionData = {
        ...questions[i],
        order: i,
        createdAt: new Date().toISOString(),
      }
      const docRef = await questionsCollectionRef.add(questionData)
      questionIds.push(docRef.id)
    }

    // Store ticket settings in a separate document — flat structure
    if (ticketSettings) {
      const settingsRef = adminDb
        .collection("events")
        .doc(eventId)
        .collection("formSettings")
        .doc("ticketSettings")

      await settingsRef.set({
        ticketSettings,
        updatedAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      message: "Questions saved successfully",
      questionIds,
    })
  } catch (error) {
    console.error("Error saving questions:", error)
    return NextResponse.json({ error: "Failed to save questions" }, { status: 500 })
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

    const access = await resolveFormAccess(eventId, auth.userId)
    if (access instanceof NextResponse) return access

    // Get questions — flat structure
    const questionsCollectionRef = adminDb
      .collection("events")
      .doc(eventId)
      .collection("questions")

    const questionsSnapshot = await questionsCollectionRef.orderBy("order").get()
    const questions = questionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Get ticket settings — flat structure
    const settingsRef = adminDb
      .collection("events")
      .doc(eventId)
      .collection("formSettings")
      .doc("ticketSettings")

    const settingsDoc = await settingsRef.get()
    const ticketSettings = settingsDoc.exists ? settingsDoc.data()?.ticketSettings : {}

    return NextResponse.json({
      success: true,
      questions,
      ticketSettings,
    })
  } catch (error) {
    console.error("Error fetching questions:", error)
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticate()
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("eventId")

    if (!eventId) {
      return fail("Missing required parameter: eventId", 400)
    }

    const access = await resolveFormAccess(eventId, auth.userId)
    if (access instanceof NextResponse) return access

    // Delete all questions — flat structure
    const questionsCollectionRef = adminDb
      .collection("events")
      .doc(eventId)
      .collection("questions")

    const questionsSnapshot = await questionsCollectionRef.get()
    const batch = adminDb.batch()
    questionsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref)
    })

    // Delete ticket settings — flat structure
    const settingsRef = adminDb
      .collection("events")
      .doc(eventId)
      .collection("formSettings")
      .doc("ticketSettings")

    batch.delete(settingsRef)

    await batch.commit()

    return NextResponse.json({
      success: true,
      message: "Form deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting form:", error)
    return NextResponse.json({ error: "Failed to delete form" }, { status: 500 })
  }
}
