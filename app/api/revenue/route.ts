import { adminDb } from "@/lib/firebase-admin"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    // Fetch user data
    const userDoc = await adminDb.collection("users").doc(userId).get()
    let userName = "Booker"

    if (userDoc.exists) {
      const userData = userDoc.data()
      userName = userData?.username || userData?.fullName || "Booker"
    }

    // Fetch events from the user's events collection
    const eventsSnapshot = await adminDb.collection("events").doc(userId).collection("userEvents").get()

    let totalEvents = 0
    let activeEvents = 0
    let pastEvents = 0
    let totalRevenue = 0
    let totalPaidOut = 0
    let totalAvailableBalance = 0
    let totalTicketsSold = 0
    const recentEventsData: any[] = []

    for (const eventDoc of eventsSnapshot.docs) {
      const eventData = eventDoc.data()
      const eventDate = new Date(eventData.eventDate)
      const isPast = eventDate < new Date()

      totalEvents++
      if (isPast) {
        pastEvents++
      } else {
        activeEvents++
      }

      const eventRevenue = eventData.totalRevenue || 0
      totalRevenue += eventRevenue
      totalTicketsSold += eventData.ticketsSold || 0

      if (eventData.totalPaidOut !== undefined) {
        totalPaidOut += eventData.totalPaidOut
      }

      const availableRevenue = eventData.availableRevenue || eventRevenue - (eventData.totalPaidOut || 0)
      totalAvailableBalance += availableRevenue

      recentEventsData.push({
        id: eventDoc.id,
        eventName: eventData.eventName || "Unnamed Event",
        eventDate: eventData.eventDate,
        ticketsSold: eventData.ticketsSold || 0,
        revenue: eventRevenue,
        availableBalance: availableRevenue,
        status: isPast ? "past" : "active",
      })
    }

    // Sort by date (most recent first)
    recentEventsData.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())

    return NextResponse.json({
      stats: {
        totalEvents,
        activeEvents,
        pastEvents,
        totalRevenue,
        availableBalance: totalAvailableBalance,
        totalPaidOut,
        totalTicketsSold,
      },
      recentEvents: recentEventsData.slice(0, 5),
      bookerName: userName,
      lastUpdated: Date.now(),
    })
  } catch (error) {
    console.error("Error fetching revenue data:", error)
    return NextResponse.json({ error: "Failed to fetch revenue data" }, { status: 500 })
  }
}
