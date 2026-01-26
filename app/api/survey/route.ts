import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, eventId, questions, ticketSettings } = body

    if (!userId || !eventId) {
      return NextResponse.json({ error: "Missing required fields: userId, eventId" }, { status: 400 })
    }

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

      const validTypes = ["short", "long", "number", "radio", "checkbox"]
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

    // Store each question as a separate document
    const questionsCollectionRef = adminDb
      .collection("events")
      .doc(userId)
      .collection("userEvents")
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

    // Store ticket settings in a separate document
    if (ticketSettings) {
      const settingsRef = adminDb
        .collection("events")
        .doc(userId)
        .collection("userEvents")
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
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const eventId = searchParams.get("eventId")

    if (!userId || !eventId) {
      return NextResponse.json({ error: "Missing required parameters: userId, eventId" }, { status: 400 })
    }

    // Get questions
    const questionsCollectionRef = adminDb
      .collection("events")
      .doc(userId)
      .collection("userEvents")
      .doc(eventId)
      .collection("questions")

    const questionsSnapshot = await questionsCollectionRef.orderBy("order").get()
    const questions = questionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Get ticket settings
    const settingsRef = adminDb
      .collection("events")
      .doc(userId)
      .collection("userEvents")
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
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const eventId = searchParams.get("eventId")

    if (!userId || !eventId) {
      return NextResponse.json({ error: "Missing required parameters: userId, eventId" }, { status: 400 })
    }

    // Delete all questions
    const questionsCollectionRef = adminDb
      .collection("events")
      .doc(userId)
      .collection("userEvents")
      .doc(eventId)
      .collection("questions")

    const questionsSnapshot = await questionsCollectionRef.get()
    const batch = adminDb.batch()
    questionsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref)
    })

    // Delete ticket settings
    const settingsRef = adminDb
      .collection("events")
      .doc(userId)
      .collection("userEvents")
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