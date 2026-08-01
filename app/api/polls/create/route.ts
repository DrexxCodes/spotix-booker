/**
 * app/api/polls/create/route.ts
 *
 * POST /api/polls/create
 *
 * Creates a poll in the FLAT voting/{pollId} collection.
 *
 * Supports two poll types:
 *   "single" → contestants[] flat list
 *   "group"  → categories[] tree (supports nested subcategories)
 *
 * All structural limits and pricing rules come from lib/poll-config.ts.
 * buyerBearsBurden is set here and is immutable after creation.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { FieldValue } from "firebase-admin/firestore"
import {
  validateVotePrice,
  MAX_SINGLE_CONTESTANTS,
  MAX_GROUP_TOP_CATEGORIES,
  MAX_GROUP_TOTAL_SUBCATEGORIES,
  MAX_CONTESTANTS_PER_CATEGORY,
} from "@/lib/poll-config"

const DEV_TAG = "spotix-api-v1"

function ok(data: object, status = 200) {
  return NextResponse.json({ success: true, developer: DEV_TAG, ...data }, { status })
}
function fail(message: string, status: number) {
  return NextResponse.json({ success: false, error: message, developer: DEV_TAG }, { status })
}

async function authenticate(): Promise<{ userId: string; isBooker: boolean } | NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get("spotix_at")?.value
  if (!token) return fail("No access token", 401)
  try {
    const payload = await verifyAccessToken(token, "spotix-booker")
    return { userId: payload.uid, isBooker: payload.isBooker }
  } catch {
    return fail("Invalid or expired access token", 401)
  }
}

// ── Category tree helpers ─────────────────────────────────────────────────────

/** Count all sub-categories (Tier 2+) recursively. Top-level cats NOT counted. */
function countDescendantCategories(cats: any[]): number {
  let total = 0
  for (const cat of cats) {
    if (Array.isArray(cat.subcategories) && cat.subcategories.length > 0) {
      total += cat.subcategories.length
      total += countDescendantCategories(cat.subcategories)
    }
  }
  return total
}

/** Validate a category node and all its descendants recursively. */
function validateCategoryTree(
  cats: any[],
  path: string,
): string | null {
  for (const [i, cat] of cats.entries()) {
    const label = `${path} > Category ${i + 1}`
    if (!cat.categoryId?.trim()) return `${label}: categoryId is required`
    if (!cat.name?.trim())       return `${label}: name is required`

    const priceErr = validateVotePrice(Number(cat.pollPrice ?? 0), `${label} price`)
    if (priceErr) return priceErr

    // Contestants — required only if this is a leaf (no subcategories)
    const hasSubs = Array.isArray(cat.subcategories) && cat.subcategories.length > 0
    const hasContestants = Array.isArray(cat.contestants) && cat.contestants.length > 0

    if (!hasSubs) {
      // Leaf node must have at least 2 contestants
      if (!hasContestants || cat.contestants.length < 2)
        return `${label}: leaf categories need at least 2 contestants`
      if (cat.contestants.length > MAX_CONTESTANTS_PER_CATEGORY)
        return `${label}: cannot have more than ${MAX_CONTESTANTS_PER_CATEGORY} contestants`
      for (const [ci, c] of cat.contestants.entries()) {
        if (!c.contestantId?.trim()) return `${label}, Contestant ${ci + 1}: contestantId is required`
        if (!c.name?.trim())         return `${label}, Contestant ${ci + 1}: name is required`
        if (!c.image?.trim())        return `${label}, Contestant ${ci + 1}: image is required`
      }
    } else {
      // Branch node: validate subcategories
      const subErr = validateCategoryTree(cat.subcategories, label)
      if (subErr) return subErr
    }
  }
  return null
}

/** Sanitise a category tree for Firestore (strip UI-only fields, init votes). */
function sanitizeCategoryTree(cats: any[]): any[] {
  return cats.map((cat: any) => {
    const hasSubs = Array.isArray(cat.subcategories) && cat.subcategories.length > 0
    return {
      categoryId:    cat.categoryId,
      name:          cat.name.trim(),
      pollPrice:     Number(cat.pollPrice ?? 0),
      contestants:   hasSubs ? [] : (cat.contestants ?? []).map((c: any) => ({
        contestantId: c.contestantId,
        name:         c.name,
        image:        c.image,
        imageType:    c.imageType === "generated" ? "generated" : "uploaded",
        imageSeed:    c.imageType === "generated" ? (c.imageSeed || c.contestantId) : null,
        votes:        0,
      })),
      subcategories: hasSubs ? sanitizeCategoryTree(cat.subcategories) : [],
    }
  })
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId, isBooker } = auth

  if (!isBooker) return fail("Only booker accounts can create polls", 403)

  let body: Record<string, any>
  try { body = await req.json() }
  catch { return fail("Invalid JSON body", 400) }

  const {
    pollName, pollImage, pollDescription,
    pollStartDate, pollStartTime,
    pollEndDate,   pollEndTime,
    pollPrice,
    contestants,
    categories,
    pollType         = "single",
    buyerBearsBurden = true,
    statsVisible     = true,
    contestantsTBD   = false,
  } = body

  // ── Common validation ───────────────────────────────────────────────────────
  if (!pollName?.trim())        return fail("pollName is required", 400)
  if (!pollImage?.trim())       return fail("pollImage is required", 400)
  if (!pollDescription?.trim()) return fail("pollDescription is required", 400)
  if (!pollStartDate || !pollStartTime) return fail("Start date and time are required", 400)
  if (!pollEndDate   || !pollEndTime)   return fail("End date and time are required", 400)
  if (!["single", "group"].includes(pollType)) return fail("pollType must be 'single' or 'group'", 400)

  const start = new Date(`${pollStartDate}T${pollStartTime}`)
  const end   = new Date(`${pollEndDate}T${pollEndTime}`)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return fail("Invalid date/time format", 400)
  if (end <= start) return fail("End date/time must be after start date/time", 400)

  // ── Single poll ─────────────────────────────────────────────────────────────
  // contestantsTBD skips ALL contestant/category requirements below —
  // the organiser is publishing name/image/schedule now and adding real
  // contestants later (typically once a linked nomination poll closes).
  // The write step forces contestants/categories to [] regardless of what
  // was sent, so this bypass can't be used to sneak in half-valid data.
  if (pollType === "single" && !contestantsTBD) {
    const priceErr = validateVotePrice(Number(pollPrice ?? 0))
    if (priceErr) return fail(priceErr, 400)

    if (!Array.isArray(contestants) || contestants.length < 2)
      return fail("At least 2 contestants are required", 400)
    if (contestants.length > MAX_SINGLE_CONTESTANTS)
      return fail(`Single polls can have at most ${MAX_SINGLE_CONTESTANTS} contestants`, 400)

    for (const [i, c] of contestants.entries()) {
      if (!c.contestantId?.trim()) return fail(`Contestant ${i + 1}: contestantId is required`, 400)
      if (!c.name?.trim())         return fail(`Contestant ${i + 1}: name is required`, 400)
      if (!c.image?.trim())        return fail(`Contestant ${i + 1}: image is required`, 400)
    }
  } else if (pollType === "single") {
    // TBD single poll — price is still meaningful (applies once contestants
    // are added later), so still validate it if one was provided.
    const priceErr = validateVotePrice(Number(pollPrice ?? 0))
    if (priceErr) return fail(priceErr, 400)
  }

  // ── Group poll ──────────────────────────────────────────────────────────────
  if (pollType === "group" && !contestantsTBD) {
    if (!Array.isArray(categories) || categories.length < 1)
      return fail("At least 1 top-level category is required for a group poll", 400)
    if (categories.length > MAX_GROUP_TOP_CATEGORIES)
      return fail(`Group polls can have at most ${MAX_GROUP_TOP_CATEGORIES} top-level categories`, 400)

    const totalSubs = countDescendantCategories(categories)
    if (totalSubs > MAX_GROUP_TOTAL_SUBCATEGORIES)
      return fail(`Total sub-categories across the poll cannot exceed ${MAX_GROUP_TOTAL_SUBCATEGORIES}`, 400)

    const treeErr = validateCategoryTree(categories, "Poll")
    if (treeErr) return fail(treeErr, 400)
  }

  // ── Write ───────────────────────────────────────────────────────────────────
  try {
    const pollRef = adminDb.collection("voting").doc()

    const doc: Record<string, any> = {
      creatorId:    userId,
      organizerId:  userId,
      pollType,
      pollName:        pollName.trim(),
      pollImage:       pollImage.trim(),
      pollDescription: pollDescription.trim(),
      pollStartDate,
      pollStartTime,
      pollEndDate,
      pollEndTime,
      pollAmount:  0,
      pollCount:   0,
      pollEntries: [],
      buyerBearsBurden: Boolean(buyerBearsBurden),
      statsVisible:     Boolean(statsVisible),
      contestantsTBD:   Boolean(contestantsTBD),
      status:    "active",
      suspended: false,
      flagged:   false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (contestantsTBD) {
      // Never trust the client's contestants/categories while TBD, even
      // though validation was already skipped above for them — force
      // empty regardless of what was sent.
      doc.pollPrice   = pollType === "single" ? Number(pollPrice ?? 0) : 0
      doc.contestants = []
      doc.categories  = []
    } else if (pollType === "single") {
      doc.pollPrice   = Number(pollPrice ?? 0)
      doc.contestants = contestants.map((c: any) => ({
        contestantId: c.contestantId,
        name:         c.name,
        image:        c.image,
        imageType:    c.imageType === "generated" ? "generated" : "uploaded",
        imageSeed:    c.imageType === "generated" ? (c.imageSeed || c.contestantId) : null,
        votes:        0,
      }))
      doc.categories  = []
    } else if (pollType === "group") {
      doc.pollPrice   = 0
      doc.contestants = []
      doc.categories  = sanitizeCategoryTree(categories)
    }

    await pollRef.set(doc)

    try {
      await adminDb.collection("users").doc(userId).update({
        totalPolls: FieldValue.increment(1),
      })
    } catch { /* non-fatal */ }

    return ok({ pollId: pollRef.id, message: "Poll created successfully" }, 201)
  } catch (err: any) {
    console.error("[POST /api/polls/create] Firestore error:", err)
    return fail("Failed to create poll", 500)
  }
}

export async function GET() {
  return fail("Method Not Allowed", 405)
}
