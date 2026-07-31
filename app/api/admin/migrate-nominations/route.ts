/**
 * app/api/admin/migrate-nominations/route.ts
 *
 * POST /api/admin/migrate-nominations
 * Body: { dryRun: boolean, migrationKey: string }
 *
 * One-time migration: copies the entire open-nomination system out of
 * Firestore (nominationPolls/{pollId} + its nominees and deviceLog
 * subcollections) into the new Supabase tables — see
 * /supabase/schema.sql. Safe to re-run: every write is an upsert keyed
 * on the same id Firestore already assigned, so running this twice just
 * re-confirms rows that are already there instead of duplicating them.
 *
 * Firestore is read-only here — this only writes to Supabase, so
 * nothing is lost if something goes wrong mid-run, and you can re-run
 * after fixing whatever broke.
 *
 * Guarded by:
 *   1. A logged-in booker session (same cookie every other /api/polls/*
 *      route checks).
 *   2. A separate MIGRATION_SECRET_KEY, typed into the migration page,
 *      so this one-time, semi-destructive operation can't be triggered
 *      by simply being logged in as a booker.
 *
 * Run this ONCE from /admin/migrate-nominations, verify the counts, then
 * flip both apps' nomination routes over (already done in this same
 * change set) and consider deleting nominationPolls from Firestore once
 * you're confident — see the README for the recommended order of
 * operations.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { adminDb } from "@/lib/firebase-admin"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { supabaseAdmin } from "@/lib/supabase"
import { nomineeDocId } from "@/lib/nomination-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Long-running migration — extend timeout as much as the platform allows.
// If your nomination data is large enough that this still isn't enough
// (Vercel Hobby caps functions at 60s regardless of this value), see the
// README for the standalone-script alternative.
export const maxDuration = 300

type LogType = "info" | "success" | "warn" | "error"
interface LogEntry { type: LogType; message: string }

function toIso(value: any): string {
  if (!value) return new Date().toISOString()
  if (typeof value?.toDate === "function") return value.toDate().toISOString()
  return new Date().toISOString()
}

const CHUNK_SIZE = 500

async function upsertChunked(
  table: string,
  rows: any[],
  onConflict: string,
  dryRun: boolean,
  log: (t: LogType, m: string) => void
): Promise<number> {
  if (rows.length === 0) return 0
  if (dryRun) return rows.length

  let written = 0
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const { error } = await supabaseAdmin.from(table).upsert(chunk, { onConflict })
    if (error) {
      log("error", `  ${table} upsert chunk (${chunk.length} rows) failed: ${error.message}`)
      throw error
    }
    written += chunk.length
  }
  return written
}

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

  const { dryRun = true, migrationKey } = body

  if (!process.env.MIGRATION_SECRET_KEY) {
    return NextResponse.json({ error: "MIGRATION_SECRET_KEY is not configured on the server" }, { status: 500 })
  }
  if (!migrationKey || migrationKey !== process.env.MIGRATION_SECRET_KEY) {
    return NextResponse.json({ error: "Invalid migration key" }, { status: 403 })
  }

  const logs: LogEntry[] = []
  const log = (type: LogType, message: string) => {
    logs.push({ type, message })
    console.log(`[migrate-nominations][${type}] ${message}`)
  }

  const result = {
    pollsScanned: 0,
    pollsMigrated: 0,
    nomineesScanned: 0,
    nomineesMigrated: 0,
    guardsScanned: 0,
    guardsMigrated: 0,
    errors: [] as string[],
  }

  try {
    log("info", `Migration started — dryRun: ${dryRun}`)

    const pollsSnap = await adminDb.collection("nominationPolls").get()
    log("info", `Found ${pollsSnap.size} nomination poll(s) in Firestore`)

    for (const pollDoc of pollsSnap.docs) {
      const pollId = pollDoc.id
      const d = pollDoc.data()
      result.pollsScanned++

      try {
        const pollRow = {
          id: pollId,
          creator_id: d.creatorId ?? "",
          poll_name: d.pollName ?? "",
          poll_image: d.pollImage ?? "",
          poll_description: d.pollDescription ?? "",
          categories: d.categories ?? [],
          status: d.status ?? "active",
          created_at: toIso(d.createdAt),
          updated_at: toIso(d.updatedAt ?? d.createdAt),
        }

        if (!dryRun) {
          const { error } = await supabaseAdmin.from("nomination_polls").upsert(pollRow, { onConflict: "id" })
          if (error) throw error
        }
        log(
          "success",
          `  [${dryRun ? "DRY" : "WRITE"}] nominationPolls/${pollId} — "${pollRow.poll_name}" (${(pollRow.categories as any[]).length} categories)`
        )
        result.pollsMigrated++

        // ── Nominees ──────────────────────────────────────────────────
        const nomineesSnap = await pollDoc.ref.collection("nominees").get()
        result.nomineesScanned += nomineesSnap.size
        const nomineeRows = nomineesSnap.docs.map((nd) => {
          const nData = nd.data()
          return {
            poll_id: pollId,
            nominee_id: nd.id,
            category_id: nData.categoryId ?? "",
            name: nData.name ?? "",
            display_name: nData.displayName ?? nData.name ?? "",
            count: nData.count ?? 0,
            created_at: toIso(nData.createdAt),
            updated_at: toIso(nData.updatedAt ?? nData.createdAt),
          }
        })
        const nomineesWritten = await upsertChunked(
          "nomination_nominees", nomineeRows, "poll_id,nominee_id", dryRun, log
        )
        result.nomineesMigrated += nomineesWritten
        log("info", `    nominees: ${nomineesSnap.size} found, ${nomineesWritten} ${dryRun ? "would be " : ""}written`)

        // ── Guards (deviceLog) ───────────────────────────────────────
        const deviceLogSnap = await pollDoc.ref.collection("deviceLog").get()
        result.guardsScanned += deviceLogSnap.size
        const guardRows = deviceLogSnap.docs
          .map((gd) => {
            const gData = gd.data()
            const categoryId: string = gData.categoryId ?? ""
            const normalizedName: string = gData.nominee ?? ""
            const nomineeId = categoryId && normalizedName ? nomineeDocId(categoryId, normalizedName) : ""
            const guardType = gd.id.includes("__device__") ? "device" : "ip"
            const guardValue: string = gData.deviceId ?? gData.ipHash ?? ""
            return {
              poll_id: pollId,
              category_id: categoryId,
              guard_type: guardType,
              guard_value: guardValue,
              nominee_id: nomineeId,
              created_at: toIso(gData.createdAt),
            }
          })
          .filter((r) => r.category_id && r.guard_value)

        const guardsWritten = await upsertChunked(
          "nomination_guards", guardRows, "poll_id,category_id,guard_type,guard_value", dryRun, log
        )
        result.guardsMigrated += guardsWritten
        log("info", `    deviceLog: ${deviceLogSnap.size} found, ${guardsWritten} ${dryRun ? "would be " : ""}written`)
      } catch (pollErr: any) {
        const msg = `Error migrating nominationPolls/${pollId}: ${pollErr.message}`
        log("error", msg)
        result.errors.push(msg)
      }
    }

    log(result.errors.length === 0 ? "success" : "warn", `Migration finished with ${result.errors.length} error(s)`)
    return NextResponse.json({ logs, result }, { status: 200 })
  } catch (err: any) {
    log("error", `Fatal migration error: ${err.message}`)
    return NextResponse.json({ logs, result, error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json(
    { message: "POST to this endpoint with { dryRun, migrationKey } to run the migration" },
    { status: 200 }
  )
}
