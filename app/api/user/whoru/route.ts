import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"

type LookupType = "email" | "name" | "phone" | "uid"

/**
 * GET /api/user/whoru?type={type}&value={value}&limit={limit}
 * Looks up a Spotix user by email, name, phone, or uid.
 * Requires a valid booker access token (spotix_at cookie or Authorization header).
 *
 * Response fields: userId, createdAt, email, fullName, phoneNumber, username
 */
export async function GET(req: Request) {
  // ─── Auth ─────────────────────────────────────────────────────────────────
  // Accept either the httpOnly cookie (browser) or an Authorization Bearer header
  // (server-to-server / transfer-tab client fetch with stored token).
  let authenticated = false

  // 1. Try cookie first
  const cookieHeader = req.headers.get("cookie") ?? ""
  const cookieMatch = cookieHeader.match(/spotix_at=([^;]+)/)
  if (cookieMatch) {
    try {
      await verifyAccessToken(cookieMatch[1], "spotix-booker")
      authenticated = true
    } catch {
      // fall through to Bearer check
    }
  }

  // 2. Try Authorization: Bearer <token>
  if (!authenticated) {
    const authHeader = req.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7)
      try {
        await verifyAccessToken(token, "spotix-booker")
        authenticated = true
      } catch {
        // fall through
      }
    }
  }

  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ─── Params ───────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") as LookupType | null
  const value = searchParams.get("value")
  const limitParam = searchParams.get("limit")

  if (!type || !value || !limitParam) {
    return Response.json(
      { error: "Missing required query params: type, value, limit" },
      { status: 400 }
    )
  }

  const validTypes: LookupType[] = ["email", "name", "phone", "uid"]
  if (!validTypes.includes(type)) {
    return Response.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    )
  }

  const limit = parseInt(limitParam, 10)
  if (isNaN(limit) || limit < 1) {
    return Response.json({ error: "limit must be a positive integer" }, { status: 400 })
  }

  try {
    let docs: FirebaseFirestore.DocumentSnapshot[] = []

    // ─── uid: direct doc fetch ───────────────────────────────────────────────
    if (type === "uid") {
      const doc = await adminDb.collection("users").doc(value).get()
      if (doc.exists) docs = [doc]
    } else {
      // ─── Map type → Firestore field name ──────────────────────────────────
      const fieldMap: Record<Exclude<LookupType, "uid">, string> = {
        email: "email",
        name: "fullName",
        phone: "phoneNumber",
      }
      const field = fieldMap[type as Exclude<LookupType, "uid">]

      const snapshot = await adminDb
        .collection("users")
        .where(field, "==", value)
        .limit(limit)
        .get()

      docs = snapshot.docs
    }

    if (docs.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    const users = docs.map((doc) => {
      const d = doc.data() ?? {}
      return {
        userId: doc.id,
        email: d.email ?? "",
        fullName: d.fullName ?? "",
        phoneNumber: d.phoneNumber ?? "",
        username: d.username ?? "",
        createdAt: d.createdAt ?? null,
      }
    })

    // If limit === 1, return a single object for convenience
    return Response.json(limit === 1 ? users[0] : { users })
  } catch (err: any) {
    console.error("[GET /api/user/whoru]", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
