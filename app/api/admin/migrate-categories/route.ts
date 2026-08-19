/**
 * app/api/admin/migrate-categories/route.ts
 *
 * POST /api/admin/migrate-categories
 * Body: { dryRun: boolean, migrationKey: string, pollId?: string }
 *
 * One-time (per-poll, but re-runnable) migration: moves a group poll's
 * legacy `categories` array field into the new
 * voting/{pollId}/categories SUBCOLLECTION — see lib/poll-categories.ts
 * for why this move happened (Firestore console couldn't even display
 * arrays this size, and every vote had to rewrite the whole tree).
 *
 * Body.pollId omitted = migrate every group poll that still has a
 * populated `categories` array field (i.e. hasn't been migrated or
 * edited-and-saved since this change shipped, since a normal save also
 * now writes to the subcollection and clears the array field). Passing
 * a specific pollId migrates just that one — handy for testing before
 * running it against everything.
 *
 * Safe to re-run: writeCategoryTree() is a full upsert-and-clear of the
 * target poll's subcollection every time, keyed on the same categoryId
 * already in the array, so running this twice on the same poll just
 * re-confirms it rather than duplicating anything. A poll with an
 * already-empty `categories` array (already migrated) is skipped.
 *
 * Guarded the same way as /api/admin/migrate-nominations:
 *   1. A logged-in booker session.
 *   2. MIGRATION_SECRET_KEY, typed into the migration page — this is a
 *      real write operation (unlike migrate-nominations' Firestore-only
 *      read), so this gate matters more here, not less.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { writeCategoryTree } from "@/lib/poll-categories"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Long-running migration when run against every group poll at once —
// extend timeout as much as the platform allows. If your poll count is
// large enough that this still isn't enough (Vercel Hobby caps
// functions at 60s regardless of this value), migrate one pollId at a
// time instead — see the pollId param above.
export const maxDuration = 300

type LogType = "info" | "success" | "warn" | "error"
interface LogEntry { type: LogType; message: string }

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get("spotix_at")?.value
  if (!token) return NextResponse.json({ error: "No access token" }, { status: 401 })
  try {
    await verifyAccessToken(token, "spotix-booker")
  } catch {
    return NextResponse.json({ error: "Invalid or expired access token" }, { status: 401 })
  }

  let body: Record<string, any>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }

  const { dryRun = true, migrationKey, pollId } = body

  if (!process.env.MIGRATION_SECRET_KEY) {
    return NextResponse.json({ error: "MIGRATION_SECRET_KEY is not configured on the server" }, { status: 500 })
  }
  if (!migrationKey || migrationKey !== process.env.MIGRATION_SECRET_KEY) {
    return NextResponse.json({ error: "Invalid migration key" }, { status: 403 })
  }

  const logs: LogEntry[] = []
  const log = (type: LogType, message: string) => {
    logs.push({ type, message })
    console.log(`[migrate-categories][${type}] ${message}`)
  }

  const result = {
    pollsScanned: 0,
    pollsMigrated: 0,
    pollsSkippedAlreadyMigrated: 0,
    categoryNodesMigrated: 0,
    errors: [] as string[],
  }

  try {
    log("info", `Migration started — dryRun: ${dryRun}${pollId ? `, pollId: ${pollId}` : " (all group polls)"}`)

    const pollsQuery = pollId
      ? adminDb.collection("voting").where("__name__", "==", pollId)
      : adminDb.collection("voting").where("pollType", "==", "group")

    const pollsSnap = await pollsQuery.get()
    log("info", `Found ${pollsSnap.size} group poll(s) to check`)

    for (const pollDoc of pollsSnap.docs) {
      const id = pollDoc.id
      const d = pollDoc.data()
      result.pollsScanned++

      try {
        const legacyCategories: any[] = Array.isArray(d.categories) ? d.categories : []

        if (legacyCategories.length === 0) {
          // Either never had categories, or already migrated (writeCategoryTree
          // clears the array field once a poll is subcollection-backed).
          result.pollsSkippedAlreadyMigrated++
          log("info", `Skipping ${id} — no legacy categories array to migrate`)
          continue
        }

        const nodeCount = countNodes(legacyCategories)

        if (dryRun) {
          log("info", `[dry run] Would migrate ${id} — "${d.pollName ?? "untitled"}" (${nodeCount} category nodes)`)
        } else {
          await writeCategoryTree(id, legacyCategories)
          log("success", `Migrated ${id} — "${d.pollName ?? "untitled"}" (${nodeCount} category nodes)`)
        }

        result.pollsMigrated++
        result.categoryNodesMigrated += nodeCount
      } catch (err: any) {
        const msg = `Failed to migrate poll ${id}: ${err.message ?? String(err)}`
        log("error", msg)
        result.errors.push(msg)
      }
    }

    log("info", `Migration ${dryRun ? "dry run " : ""}complete`)

    return NextResponse.json({ success: true, dryRun, result, logs })
  } catch (err: any) {
    log("error", `Migration failed: ${err.message ?? String(err)}`)
    return NextResponse.json({ success: false, error: err.message ?? String(err), result, logs }, { status: 500 })
  }
}

function countNodes(cats: any[]): number {
  let total = 0
  for (const cat of cats ?? []) {
    total += 1
    if (Array.isArray(cat.subcategories)) total += countNodes(cat.subcategories)
  }
  return total
}

export async function GET()   { return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 }) }
export async function DELETE(){ return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 }) }
