import { adminDb } from "@/lib/firebase-admin"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const userRef = adminDb.collection("users").doc(userId)
    const userDoc = await userRef.get()

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userData = userDoc.data()
    const bvt = userData?.bvt || null

    const verificationRef = adminDb.collection("verification").where("uid", "==", userId)
    const verificationSnapshot = await verificationRef.get()

    let isVerified = false
    let verificationState = "Not Verified"

    if (!verificationSnapshot.empty) {
      const verificationData = verificationSnapshot.docs[0].data()
      verificationState = verificationData.verificationState || "Not Verified"
      isVerified = userData?.isVerified || false
    }

    return NextResponse.json(
      {
        bvt,
        isVerified,
        verificationState,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("BVT fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch BVT" }, { status: 500 })
  }
}
