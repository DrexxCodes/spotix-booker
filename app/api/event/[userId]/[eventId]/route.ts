import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore"

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ userId: string; eventId: string }> },
) {
  try {
    const params = await paramsPromise
    const { userId, eventId } = params

    if (!userId || !eventId) {
      return NextResponse.json({ error: "User ID and Event ID are required" }, { status: 400 })
    }

    const eventDocRef = doc(db, "events", userId, "userEvents", eventId)
    const eventDoc = await getDoc(eventDocRef)

    if (!eventDoc.exists()) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const eventData = eventDoc.data()

    // Fetch attendees
    const attendeesCollectionRef = collection(db, "events", userId, "userEvents", eventId, "attendees")
    const attendeesSnapshot = await getDocs(attendeesCollectionRef)
    const attendees = attendeesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Fetch payouts
    const payoutsCollectionRef = collection(db, "events", userId, "userEvents", eventId, "payouts")
    const payoutsQuery = query(payoutsCollectionRef, orderBy("createdAt", "desc"))
    const payoutsSnapshot = await getDocs(payoutsQuery)
    const payouts = payoutsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Fetch discounts
    const discountsCollectionRef = collection(db, "events", userId, "userEvents", eventId, "discounts")
    const discountsSnapshot = await getDocs(discountsCollectionRef)
    const discounts = discountsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    return NextResponse.json({
      event: {
        id: eventDoc.id,
        ...eventData,
      },
      attendees,
      payouts,
      discounts,
    })
  } catch (error) {
    console.error("Error fetching event:", error)
    return NextResponse.json({ error: "Failed to fetch event data" }, { status: 500 })
  }
}
