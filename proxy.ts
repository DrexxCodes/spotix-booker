import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy for authentication and role-based access control
 * 
 * Rules:
 * 1. Public routes: /login and /not-booker are always accessible
 * 2. Protected routes: All other routes require authentication
 * 3. Role check: Non-bookers (isBooker=false) can only access /login and /not-booker
 * 4. Redirect preservation: Unauthenticated users are redirected to /login with their original path
 */

// Public routes that don't require authentication
const publicRoutes = ["/login"];

// Routes that non-bookers can access
const nonBookerRoutes = ["/login", "/not-booker"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get session and isBooker from cookies
  const session = request.cookies.get("session")?.value;
  const isBooker = request.cookies.get("isBooker")?.value === "true";

  // Allow public routes (login)
  if (publicRoutes.includes(pathname)) {
    // If already authenticated and trying to access login, redirect to home
    if (session && isBooker) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Check if user is authenticated
  if (!session) {
    // Not authenticated - redirect to login with original path
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated - check if they're a booker
  if (!isBooker) {
    // Non-booker can only access non-booker routes
    if (!nonBookerRoutes.includes(pathname)) {
      return NextResponse.redirect(new URL("/not-booker", request.url));
    }
  }

  // User is authenticated and authorized (or on allowed non-booker route)
  return NextResponse.next();
}

// Configure which routes the proxy should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.webp).*)",
  ],
};