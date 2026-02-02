import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Logout API Route
 * 
 * POST: Clear server session and revoke user tokens
 */

/**
 * Handle non-POST requests
 */
async function handleForbiddenMethod(method: string) {
  return NextResponse.json(
    {
      error: "Method Not Allowed",
      message: `${method} method is forbidden`,
      developer: "API developed and maintained by Spotix Technologies",
    },
    { status: 405 }
  );
}

export async function GET(request: NextRequest) {
  return handleForbiddenMethod(request.method);
}

export async function PUT(request: NextRequest) {
  return handleForbiddenMethod(request.method);
}

export async function DELETE(request: NextRequest) {
  return handleForbiddenMethod(request.method);
}

export async function PATCH(request: NextRequest) {
  return handleForbiddenMethod(request.method);
}

/**
 * POST Handler - Logout and clear session
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    // Clear cookies immediately
    cookieStore.delete("session");
    cookieStore.delete("isBooker");

    // If there's a session cookie, revoke all refresh tokens for the user
    if (sessionCookie) {
      try {
        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
        await adminAuth.revokeRefreshTokens(decodedClaims.uid);
        console.log("Refresh tokens revoked for user:", decodedClaims.uid);
      } catch (error) {
        console.error("Error revoking tokens:", error);
        // Continue anyway since cookies are already cleared
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
        developer: "API developed and maintained by Spotix Technologies",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Logout error:", error);

    // Even if there's an error, clear the cookies
    const cookieStore = await cookies();
    cookieStore.delete("session");
    cookieStore.delete("isBooker");

    return NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
        developer: "API developed and maintained by Spotix Technologies",
      },
      { status: 200 }
    );
  }
}