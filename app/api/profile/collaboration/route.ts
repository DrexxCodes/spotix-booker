import { adminDb } from "@/lib/firebase-admin"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    console.log("[v0] Collaboration API called")
    
    let body: any
    try {
      body = await req.json()
      // console.log("[v0] Request body received:", body)
    } catch (parseError) {
      console.error("[v0] Failed to parse JSON:", parseError)
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { userId } = body

    // console.log("[v0] Extracted userId:", userId)

    if (!userId) {
      console.error("[v0] Missing userId in request")
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Get the user document to fetch current collaboration state
    const userDocRef = adminDb.collection("users").doc(userId)
    const userDoc = await userDocRef.get()

    // console.log("[v0] User doc exists:", userDoc.exists)

    if (!userDoc.exists) {
      console.error("User document not found for:", userId)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get current collaboration state and toggle it
    const currentCollaborationState = userDoc.data()?.enabledCollaboration || false
    const newCollaborationState = !currentCollaborationState

    // console.log("Toggling collaboration from", currentCollaborationState, "to", newCollaborationState)

    // Update user document with toggled state
    await userDocRef.update({
      enabledCollaboration: newCollaborationState,
    })


    return NextResponse.json({ success: true, enabledCollaboration: newCollaborationState })
  } catch (error) {
    console.error("Collaboration toggle error:", error)
    return NextResponse.json({ error: "Failed to update collaboration setting", details: String(error) }, { status: 500 })
  }
}
