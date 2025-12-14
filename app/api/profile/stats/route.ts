import { type NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    // Fetch events from the user's events collection
    const eventsSnapshot = await adminDb.collection("events").doc(userId).collection("userEvents").get()

    let eventsCreated = 0
    let totalRevenue = 0

    for (const eventDoc of eventsSnapshot.docs) {
      const eventData = eventDoc.data()
      eventsCreated++
      totalRevenue += eventData.totalRevenue || 0
    }

    return NextResponse.json({
      eventsCreated,
      totalRevenue,
    })
  } catch (error) {
    console.error("Error fetching profile stats:", error)
    return NextResponse.json({ error: "Failed to fetch profile stats" }, { status: 500 })
  }
}
