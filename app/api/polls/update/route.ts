/**
 * app/api/polls/update/route.ts
 *
 * PATCH /api/polls/update
 *
 * Updates editable fields on a poll in the FLAT voting/{pollId} collection.
 *
 * Immutable after creation:
 *   - contestantId (votes preserved)
 *   - buyerBearsBurden
 *   - pollType
 *
 * Always allowed:
 *   - statsVisible toggle
 *   - adding new contestants / categories
 *   - editing names, prices, images, schedule
 *
 * Never allowed:
 *   - deleting a contestant or category that has ≥ 1 vote
 *
 * contestantsTBD: self-healing — stays true only while contestants/
 * categories are still under the minimum required count, regardless of
 * what the request explicitly asks for. Clears automatically the moment
 * a real lineup is submitted, so callers that don't know about this
 * field (an older edit UI, for instance) don't need to explicitly unset
 * it — see the effectiveTBD computation below.
 *
 * All structural limits come from lib/poll-config.ts.
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

// ── Category-tree helpers ─────────────────────────────────────────────────────

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

/** Build a flat map of {categoryId → category} for the entire tree. */
function flattenCategoryMap(cats: any[], map: Map<string, any> = new Map()): Map<string, any> {
  for (const cat of cats) {
    map.set(cat.categoryId, cat)
    if (Array.isArray(cat.subcategories)) flattenCategoryMap(cat.subcategories, map)
  }
  return map
}

/**
 * Validate + merge a category tree.
 * Existing categories' contestant vote counts are preserved from existingMap.
 * Throws (returns) an error string if any rule is violated.
 */
function validateAndMergeCategoryTree(
  incoming:    any[],
  existingMap: Map<string, any>,
  path:        string,
): { error: string } | { merged: any[] } {
  const merged: any[] = []

  for (const [i, cat] of incoming.entries()) {
    const label = `${path} > "${cat.name ?? `Category ${i + 1}`}"`
    if (!cat.categoryId?.trim()) return { error: `${label}: categoryId is required` }
    if (!cat.name?.trim())       return { error: `${label}: name is required` }

    const priceErr = validateVotePrice(Number(cat.pollPrice ?? 0), `${label} price`)
    if (priceErr) return { error: priceErr }

    const hasSubs        = Array.isArray(cat.subcategories) && cat.subcategories.length > 0
    const existingCat    = existingMap.get(cat.categoryId)
    const existingConts: any[] = existingCat?.contestants ?? []
    const existingContMap = new Map(existingConts.map((c: any) => [c.contestantId, c]))
    const incomingContIds = new Set((cat.contestants ?? []).map((c: any) => c.contestantId))

    if (!hasSubs) {
      // ── Leaf node ──────────────────────────────────────────────────────────
      if (!Array.isArray(cat.contestants) || cat.contestants.length < 2)
        return { error: `${label}: leaf categories need at least 2 contestants` }
      if (cat.contestants.length > MAX_CONTESTANTS_PER_CATEGORY)
        return { error: `${label}: cannot have more than ${MAX_CONTESTANTS_PER_CATEGORY} contestants` }

      // Check: contestants with votes cannot be removed
      for (const [cid, ec] of existingContMap) {
        if ((ec.votes ?? 0) > 0 && !incomingContIds.has(cid))
          return { error: `${label}: contestant "${ec.name}" has votes and cannot be removed` }
      }

      const mergedContestants = cat.contestants.map((c: any) => {
        const ex = existingContMap.get(c.contestantId)
        if (!c.contestantId?.trim()) return null
        if (!c.name?.trim())         return null
        if (!c.image?.trim())        return null
        return {
          contestantId: c.contestantId,
          name:         c.name.trim(),
          image:        c.image.trim(),
          votes:        ex?.votes ?? 0,
        }
      })
      if (mergedContestants.some((c) => c === null))
        return { error: `${label}: one or more contestants have missing fields` }

      merged.push({
        categoryId:   cat.categoryId,
        name:         cat.name.trim(),
        pollPrice:    Number(cat.pollPrice ?? 0),
        contestants:  mergedContestants,
        subcategories: [],
      })
    } else {
      // ── Branch node ────────────────────────────────────────────────────────
      // Check: if existing was a leaf with votes, cannot convert to branch
      if (existingCat && existingConts.some((c: any) => (c.votes ?? 0) > 0)) {
        // Determine if incoming subcats contain all existing voted contestants
        // (We disallow structural promotion of voted leaf → branch entirely)
        return { error: `${label}: this category has contestant votes and cannot be converted to a branch` }
      }

      const subResult = validateAndMergeCategoryTree(cat.subcategories, existingMap, label)
      if ("error" in subResult) return subResult

      merged.push({
        categoryId:   cat.categoryId,
        name:         cat.name.trim(),
        pollPrice:    Number(cat.pollPrice ?? 0),
        contestants:  [],
        subcategories: subResult.merged,
      })
    }
  }

  return { merged }
}

/**
 * Check recursively that no existing category with votes is being deleted.
 * existingCats = from DB, incomingIds = flat Set of all categoryIds in the update payload.
 */
function checkNoVotedCategoryDeleted(existingCats: any[], incomingIds: Set<string>): string | null {
  for (const cat of existingCats) {
    if (!incomingIds.has(cat.categoryId)) {
      const hasVotes = (cat.contestants ?? []).some((c: any) => (c.votes ?? 0) > 0)
      if (hasVotes)
        return `Category "${cat.name}" has votes and cannot be deleted`
    }
    if (Array.isArray(cat.subcategories)) {
      const err = checkNoVotedCategoryDeleted(cat.subcategories, incomingIds)
      if (err) return err
    }
  }
  return null
}

function collectAllIds(cats: any[], ids: Set<string> = new Set()): Set<string> {
  for (const cat of cats) {
    ids.add(cat.categoryId)
    if (Array.isArray(cat.subcategories)) collectAllIds(cat.subcategories, ids)
  }
  return ids
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let body: Record<string, any>
  try { body = await req.json() }
  catch { return fail("Invalid JSON body", 400) }

  const {
    pollId,
    pollName, pollImage, pollDescription,
    pollStartDate, pollStartTime,
    pollEndDate,   pollEndTime,
    pollPrice,
    contestants,
    categories,
    statsVisible,
    contestantsTBD,
  } = body

  if (!pollId?.trim()) return fail("pollId is required", 400)

  // ── Ownership check ─────────────────────────────────────────────────────────
  const pollRef  = adminDb.collection("voting").doc(pollId)
  const pollSnap = await pollRef.get()
  if (!pollSnap.exists) return fail("Poll not found", 404)

  const existingData = pollSnap.data()!
  const owner        = existingData.creatorId ?? existingData.organizerId ?? null
  if (owner !== userId) return fail("You do not own this poll", 403)

  const pollType = existingData.pollType ?? "single"

  // Contestants TBD: callers that don't know about this field (an older
  // edit page, for instance) fall back to whatever's already on the poll,
  // so nothing changes for them. A poll only STAYS in TBD mode if the
  // incoming contestants/categories are still under the minimum — the
  // moment a real lineup is submitted, this clears itself automatically
  // regardless of what contestantsTBD was requested as, so "finishing" a
  // TBD poll doesn't require the caller to explicitly know to unset it.
  const requestedTBD = typeof contestantsTBD === "boolean" ? contestantsTBD : Boolean(existingData.contestantsTBD)
  const singleIsShort = pollType === "single" && (!Array.isArray(contestants) || contestants.length < 2)
  const groupIsShort  = pollType === "group"  && (!Array.isArray(categories)  || categories.length  < 1)
  const effectiveTBD  = requestedTBD && (pollType === "single" ? singleIsShort : groupIsShort)

  // ── Common field validation ──────────────────────────────────────────────────
  if (!pollName?.trim())        return fail("pollName is required", 400)
  if (!pollImage?.trim())       return fail("pollImage is required", 400)
  if (!pollDescription?.trim()) return fail("pollDescription is required", 400)
  if (!pollStartDate || !pollStartTime) return fail("Start date and time are required", 400)
  if (!pollEndDate   || !pollEndTime)   return fail("End date and time are required", 400)

  const start = new Date(`${pollStartDate}T${pollStartTime}`)
  const end   = new Date(`${pollEndDate}T${pollEndTime}`)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return fail("Invalid date/time format", 400)
  if (end <= start) return fail("End date/time must be after start date/time", 400)

  const updatePayload: Record<string, any> = {
    pollName:        pollName.trim(),
    pollImage:       pollImage.trim(),
    pollDescription: pollDescription.trim(),
    pollStartDate,
    pollStartTime,
    pollEndDate,
    pollEndTime,
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (typeof statsVisible === "boolean") updatePayload.statsVisible = statsVisible
  updatePayload.contestantsTBD = effectiveTBD

  // ── Single poll ─────────────────────────────────────────────────────────────
  if (pollType === "single" && effectiveTBD) {
    // Still TBD — price is kept if provided (meaningful once contestants
    // are eventually added), contestants forced empty regardless of
    // whatever partial rows were in the request.
    if (pollPrice !== undefined) {
      const priceErr = validateVotePrice(Number(pollPrice ?? 0))
      if (priceErr) return fail(priceErr, 400)
      updatePayload.pollPrice = Number(pollPrice ?? 0)
    }
    updatePayload.contestants = []
  } else if (pollType === "single") {
    const priceErr = validateVotePrice(Number(pollPrice ?? 0))
    if (priceErr) return fail(priceErr, 400)

    if (!Array.isArray(contestants) || contestants.length < 2)
      return fail("At least 2 contestants are required", 400)
    if (contestants.length > MAX_SINGLE_CONTESTANTS)
      return fail(`Single polls can have at most ${MAX_SINGLE_CONTESTANTS} contestants`, 400)

    const existingConts: any[] = existingData.contestants ?? []
    const existingMap  = new Map(existingConts.map((c: any) => [c.contestantId, c]))
    const incomingIds  = new Set(contestants.map((c: any) => c.contestantId))

    for (const [id, ec] of existingMap) {
      if ((ec.votes ?? 0) > 0 && !incomingIds.has(id))
        return fail(`Contestant "${ec.name}" has votes and cannot be removed`, 400)
    }

    for (const [i, c] of contestants.entries()) {
      if (!c.contestantId?.trim()) return fail(`Contestant ${i + 1}: contestantId is required`, 400)
      if (!c.name?.trim())         return fail(`Contestant ${i + 1}: name is required`, 400)
      if (!c.image?.trim())        return fail(`Contestant ${i + 1}: image is required`, 400)
    }

    updatePayload.pollPrice   = Number(pollPrice ?? 0)
    updatePayload.contestants = contestants.map((c: any) => {
      const ex = existingMap.get(c.contestantId)
      return {
        contestantId: c.contestantId,
        name:         c.name.trim(),
        image:        c.image.trim(),
        votes:        ex?.votes ?? 0,
      }
    })
  }

  // ── Group poll ──────────────────────────────────────────────────────────────
  if (pollType === "group" && effectiveTBD) {
    updatePayload.categories = []
  } else if (pollType === "group") {
    if (!Array.isArray(categories) || categories.length < 1)
      return fail("At least 1 top-level category is required", 400)
    if (categories.length > MAX_GROUP_TOP_CATEGORIES)
      return fail(`Group polls can have at most ${MAX_GROUP_TOP_CATEGORIES} top-level categories`, 400)

    const totalSubs = countDescendantCategories(categories)
    if (totalSubs > MAX_GROUP_TOTAL_SUBCATEGORIES)
      return fail(`Total sub-categories cannot exceed ${MAX_GROUP_TOTAL_SUBCATEGORIES}`, 400)

    // Build flat map of existing categories from DB tree
    const existingCats: any[] = existingData.categories ?? []
    const existingMap         = flattenCategoryMap(existingCats)

    // Check for voted category deletions
    const incomingIds = collectAllIds(categories)
    const delErr      = checkNoVotedCategoryDeleted(existingCats, incomingIds)
    if (delErr) return fail(delErr, 400)

    // Validate and merge
    const result = validateAndMergeCategoryTree(categories, existingMap, "Poll")
    if ("error" in result) return fail(result.error, 400)

    updatePayload.categories = result.merged
  }

  // ── Write ───────────────────────────────────────────────────────────────────
  try {
    await pollRef.update(updatePayload)
    return ok({ message: "Poll updated successfully", pollId })
  } catch (err: any) {
    console.error("[PATCH /api/polls/update] Firestore error:", err)
    return fail("Failed to update poll", 500)
  }
}

export async function GET()    { return fail("Method Not Allowed", 405) }
export async function POST()   { return fail("Method Not Allowed", 405) }
export async function DELETE() { return fail("Method Not Allowed", 405) }
