/**
 * app/api/polls/nominations/[pollId]/route.ts
 *
 * GET   /api/polls/nominations/:pollId → Fetch one nomination poll (owner only)
 * PATCH /api/polls/nominations/:pollId → { status: "active" | "closed" }
 * DELETE /api/polls/nominations/:pollId → Delete (only if no nominees yet)
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { FieldValue } from "firebase-admin/firestore"
import { redis } from "@/lib/redis"
import { MAX_NOMINATION_CATEGORIES, genNominationCategoryId, type NominationCategory } from "@/lib/nomination-config"

const DEV_TAG = "spotix-api-v1"

function ok(data: object, status = 200) {
  return NextResponse.json({ success: true, developer: DEV_TAG, ...data }, { status })
}
function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message, developer: DEV_TAG }, { status })
}

async function authenticate(): Promise<{ userId: string } | NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get("spotix_at")?.value
  if (!token) return fail("No access token", 401)
  try {
    const payload = await verifyAccessToken(token, "spotix-booker")
    return { userId: payload.uid }
  } catch {
    return fail("Invalid or expired access token", 401)
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { pollId } = await params

  try {
    const snap = await adminDb.collection("nominationPolls").doc(pollId).get()
    if (!snap.exists) return fail("Nomination poll not found", 404)
    const d = snap.data()!
    if (d.creatorId !== userId) return fail("Not authorized to view this poll", 403)

    return ok({
      poll: {
        pollId: snap.id,
        pollName: d.pollName ?? "",
        pollImage: d.pollImage ?? "",
        pollDescription: d.pollDescription ?? "",
        categories: d.categories ?? [],
        status: d.status ?? "active",
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? "",
      },
    })
  } catch (err: any) {
    console.error("[GET /api/polls/nominations/[pollId]] error:", err)
    return fail("Failed to fetch nomination poll", 500)
  }
}

/**
 * PATCH /api/polls/nominations/:pollId
 * Body (all optional, merge-patch style):
 *   { pollName?, pollImage?, pollDescription?, status?, categories? }
 *
 * categories, when provided, is the FULL desired category list:
 *   - Existing categories: pass their real categoryId to rename in place
 *     (nominees stay attached — they're keyed by categoryId, not name).
 *   - New categories: omit categoryId (or pass null) — the server assigns one.
 *   - Removing a category: just leave it out of the array — but this is
 *     rejected if that category already has nominees, to avoid orphaning
 *     nominee data silently.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { pollId } = await params

  let body: Record<string, any>
  try { body = await req.json() }
  catch { return fail("Invalid JSON body", 400) }

  const ref = adminDb.collection("nominationPolls").doc(pollId)
  const snap = await ref.get()
  if (!snap.exists) return fail("Nomination poll not found", 404)
  const existing = snap.data()!
  if (existing.creatorId !== userId) return fail("Not authorized to update this poll", 403)

  const updates: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() }

  if (body.status !== undefined) {
    if (!["active", "closed"].includes(body.status)) return fail("status must be 'active' or 'closed'", 400)
    updates.status = body.status
  }
  if (body.pollName !== undefined) {
    if (!String(body.pollName).trim()) return fail("pollName cannot be empty", 400)
    updates.pollName = String(body.pollName).trim()
  }
  if (body.pollImage !== undefined) {
    if (!String(body.pollImage).trim()) return fail("pollImage cannot be empty", 400)
    updates.pollImage = String(body.pollImage).trim()
  }
  if (body.pollDescription !== undefined) {
    updates.pollDescription = String(body.pollDescription ?? "").trim()
  }

  if (body.categories !== undefined) {
    if (!Array.isArray(body.categories) || body.categories.length === 0)
      return fail("At least 1 category is required", 400)
    if (body.categories.length > MAX_NOMINATION_CATEGORIES)
      return fail(`Max ${MAX_NOMINATION_CATEGORIES} categories allowed`, 400)

    const existingCategories: NominationCategory[] = existing.categories ?? []
    const existingIds = new Set(existingCategories.map((c) => c.categoryId))

    const nextCategories: NominationCategory[] = []
    const seenNames = new Set<string>()
    const seenIds = new Set<string>()

    for (const [i, c] of body.categories.entries()) {
      const name = String(c?.name ?? "").trim()
      if (!name) return fail(`Category ${i + 1}: name is required`, 400)
      const nameKey = name.toLowerCase()
      if (seenNames.has(nameKey)) return fail(`Category "${name}" is duplicated`, 400)
      seenNames.add(nameKey)

      let categoryId: string = c?.categoryId
      if (!categoryId || !existingIds.has(categoryId)) {
        categoryId = genNominationCategoryId()
      }
      seenIds.add(categoryId)
      nextCategories.push({ categoryId, name })
    }

    // Any existing category NOT present in the new list is being removed —
    // block it if it already has nominees.
    const removedIds = [...existingIds].filter((id) => !seenIds.has(id))
    if (removedIds.length > 0) {
      const chunks: string[][] = []
      for (let i = 0; i < removedIds.length; i += 10) chunks.push(removedIds.slice(i, i + 10))

      let blockedIds: string[] = []
      for (const chunk of chunks) {
        const nomineesSnap = await ref.collection("nominees").where("categoryId", "in", chunk).limit(1).get()
        if (!nomineesSnap.empty) blockedIds.push(nomineesSnap.docs[0].data().categoryId)
      }

      if (blockedIds.length > 0) {
        const removedNames = existingCategories.filter((c) => blockedIds.includes(c.categoryId)).map((c) => c.name).join(", ")
        return fail(`Cannot remove categories that already have nominees: ${removedNames}. Close the poll instead.`, 409)
      }
    }

    updates.categories = nextCategories
  }

  try {
    await ref.update(updates)
    // Same Upstash instance as spotix-user — bust its cache so edits show
    // up immediately instead of waiting out the 60s TTL.
    await redis.del(`nomination-poll:${pollId}`).catch(() => {})
    return ok({ message: "Nomination poll updated" })
  } catch (err: any) {
    console.error("[PATCH /api/polls/nominations/[pollId]] error:", err)
    return fail("Failed to update nomination poll", 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { pollId } = await params

  try {
    const ref = adminDb.collection("nominationPolls").doc(pollId)
    const snap = await ref.get()
    if (!snap.exists) return fail("Nomination poll not found", 404)
    if (snap.data()?.creatorId !== userId) return fail("Not authorized to delete this poll", 403)

    const nomineesSnap = await ref.collection("nominees").limit(1).get()
    if (!nomineesSnap.empty)
      return fail("Cannot delete a nomination poll that already has nominees — close it instead", 409)

    await ref.delete()
    return ok({ message: "Nomination poll deleted" })
  } catch (err: any) {
    console.error("[DELETE /api/polls/nominations/[pollId]] error:", err)
    return fail("Failed to delete nomination poll", 500)
  }
}
