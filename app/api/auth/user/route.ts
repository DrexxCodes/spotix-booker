import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * User API Route
 * 
 * POST: Handle user signup and login
 * GET: Friendly message (not meant for public access)
 */

/**
 * GET Handler
 * Returns a friendly message for unauthorized access
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      message: "You're not meant to be here but welcome to the User API",
      hint: "This endpoint accepts POST requests for user signup and login",
      developer: "API developed and maintained by Spotix Technologies",
    },
    { status: 200 }
  );
}

/**
 * POST Handler
 * Handle user signup and login based on action parameter
 * 
 * Signup Body:
 * {
 *   action: "signup",
 *   email: string,
 *   password: string,
 *   fullName: string,
 *   username: string,
 *   referralCode?: string
 * }
 * 
 * Login Body:
 * {
 *   action: "login",
 *   email: string,
 *   password: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "login") {
      return await handleLogin(body);
    } else {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Invalid action. Must be 'login'",
          developer: "API developed and maintained by Spotix Technologies",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in user API:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
        developer: "API developed and maintained by Spotix Technologies",
      },
      { status: 500 }
    );
  }
}


/**
 * Handle User Login
 */
async function handleLogin(body: any) {
  const { email, password } = body;

  // Validate required fields
  if (!email || !password) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "Missing required fields: email, password",
        developer: "API developed and maintained by Spotix Technologies",
      },
      { status: 400 }
    );
  }

  try {
    // Get user by email
    const userRecord = await adminAuth.getUserByEmail(email);
    const userId = userRecord.uid;

    // Fetch user document from Firestore
    const userDoc = await adminDb.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        {
          error: "Not Found",
          message: "User profile not found",
          developer: "API developed and maintained by Spotix Technologies",
        },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Fetch balance from IWSS collection
    let balance = 0;
    try {
      const iwssDoc = await adminDb.collection("IWSS").doc(userId).get();
      if (iwssDoc.exists) {
        const iwssData = iwssDoc.data();
        balance = iwssData?.balance || 0;
      }
    } catch (iwssError) {
      console.error("Error fetching IWSS balance:", iwssError);
    }

    // Update last login timestamp
    try {
      await adminDb.collection("users").doc(userId).update({
        lastLogin: new Date().toISOString(),
      });
    } catch (updateError) {
      console.error("Error updating last login:", updateError);
    }

    // Return user data
    return NextResponse.json(
      {
        success: true,
        message: "Login successful",
        user: {
          uid: userId,
          email: userRecord.email || email,
          username: userData?.username || "",
          fullName: userData?.fullName || "",
          emailVerified: userRecord.emailVerified,
          isBooker: userData?.isBooker || false,
          balance: balance,
          createdAt: userData?.createdAt || "",
          lastLogin: new Date().toISOString(),
        },
        developer: "API developed and maintained by Spotix Technologies",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Login error:", error);

    let errorMessage = "Unable to sign in. Please try again";
    if (error.code === "auth/user-not-found") {
      errorMessage = "Incorrect email or password";
    } else if (error.code === "auth/invalid-email") {
      errorMessage = "Please enter a valid email address";
    }

    return NextResponse.json(
      {
        error: "Login Failed",
        message: errorMessage,
        details: error.message,
        developer: "API developed and maintained by Spotix Technologies",
      },
      { status: 401 }
    );
  }
}