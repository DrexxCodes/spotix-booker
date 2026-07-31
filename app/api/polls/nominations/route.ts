/**
 * app/api/polls/nominations/route.ts
 *
 * POST /api/polls/nominations  → Create a new open-nomination poll
 * GET  /api/polls/nominations  → List nomination polls owned by the caller
 *                                 (used by the "Import from Nominees" dialog
 *                                 in the main poll creator)
 *
 * Data source: Supabase (nomination_polls table). Nominees live in the
 * nomination_nominees table, written by the public spotix-user nominate
 * endpoint via the submit_nomination() RPC. See
 * /README-SUPABASE-NOMINATIONS.md and /supabase/schema.sql.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { createNominationPoll, listNominationPollsByCreator } from "@/lib/nomination-db"
import {
  MAX_NOMINATION_CATEGORIES,
  genNominationCategoryId,
  type NominationCategory,
} from "@/lib/nomination-config"

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

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId, isBooker } = auth
  if (!isBooker) return fail("Only booker accounts can create nomination polls", 403)

  let body: Record<string, any>
  try { body = await req.json() }
  catch { return fail("Invalid JSON body", 400) }

  const { pollName, pollImage, pollDescription, categories } = body

  if (!pollName?.trim())  return fail("pollName is required", 400)
  if (!pollImage?.trim()) return fail("pollImage is required", 400)
  if (!Array.isArray(categories) || categories.length === 0)
    return fail("At least 1 category is required", 400)
  if (categories.length > MAX_NOMINATION_CATEGORIES)
    return fail(`Max ${MAX_NOMINATION_CATEGORIES} categories allowed`, 400)

  const cleanCategories: NominationCategory[] = []
  const seenNames = new Set<string>()
  for (const [i, c] of categories.entries()) {
    const name = String(c?.name ?? "").trim()
    if (!name) return fail(`Category ${i + 1}: name is required`, 400)
    const key = name.toLowerCase()
    if (seenNames.has(key)) return fail(`Category "${name}" is duplicated`, 400)
    seenNames.add(key)
    cleanCategories.push({ categoryId: genNominationCategoryId(), name })
  }

  try {
    const pollId = await createNominationPoll({
      creatorId: userId,
      pollName: pollName.trim(),
      pollImage: pollImage.trim(),
      pollDescription: (pollDescription ?? "").trim(),
      categories: cleanCategories,
    })

    return ok(
      { pollId, message: "Nomination poll created successfully" },
      201
    )
  } catch (err: any) {
    console.error("[POST /api/polls/nominations] error:", err)
    return fail("Failed to create nomination poll", 500)
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    const polls = await listNominationPollsByCreator(userId)
    return ok({ polls })
  } catch (err: any) {
    console.error("[GET /api/polls/nominations] error:", err)
    return fail("Failed to fetch nomination polls", 500)
  }
}
