/**
 * app/api/polls/[pollId]/results/route.ts
 *
 * GET  /api/polls/:pollId/results  → latest generated report (if any), with
 *                                     a downloadUrl on our own domain.
 * POST /api/polls/:pollId/results  → generate a new results PDF.
 *
 * Backs the "Download Result" button on app/polls/[pollId]/page.tsx:
 *   1. Click → POST here. Frontend shows "We are preparing the results.
 *      Check back later" while this request is in flight.
 *   2. This route validates the poll has actually ended, builds the
 *      report (see @/lib/poll-results-pdf), uploads it to Supabase
 *      Storage, and records it in the `poll_results` table
 *      (@/lib/poll-results-store, see /supabase/schema-poll-results.sql).
 *   3. On success the frontend flips to "We have generated your report,
 *      click to download".
 *
 * `downloadUrl` below always points at our own
 * /api/polls/:pollId/results/download route (see that file), NOT at the
 * underlying Supabase signed URL — that route fetches from Supabase
 * server-side and streams the bytes back, so the user never sees a
 * supabase.co URL.
 *
 * Access: poll owner OR an active poll team member — same rule as every
 * other read/write on this poll (see @/lib/poll-team-access).
 *
 * Contestants may be stored as an array or a map keyed by contestantId —
 * this route never reads a `contestants` field directly, everything goes
 * through @/lib/contestants (toContestantArray / computeStandings) via
 * the report builders in @/lib/poll-results-pdf.
 */

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { resolvePollAccess } from "@/lib/poll-team-access"
import { fetchCategoryTree } from "@/lib/poll-categories"
import {
  generatePollResultsPdf,
  buildGroupPollSections,
  buildSinglePollSections,
} from "@/lib/poll-results-pdf"
import {
  buildResultFileName,
  uploadPollResultPdf,
  insertPollResultRow,
  getLatestPollResult,
} from "@/lib/poll-results-store"

/** Own-domain download URL for a poll's latest report — never the raw Supabase signed URL. */
function buildDownloadUrl(pollId: string): string {
  return `/api/polls/${pollId}/results/download`
}

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

/** True once `pollEndDate`/`pollEndTime` are in the past. Mirrors getPollStatus() in the booker UI. */
function hasPollEnded(pollEndDate: string, pollEndTime: string): boolean {
  const end = new Date(`${pollEndDate}T${pollEndTime}`)
  if (isNaN(end.getTime())) return false
  return new Date() > end
}

// GET — latest report for this poll, if one exists.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { pollId } = await params

  try {
    const access = await resolvePollAccess(pollId, userId)
    if (!access.ok) return fail(access.error, access.status)

    const latest = await getLatestPollResult(pollId)
    if (!latest || latest.status !== "ready") {
      return ok({ exists: false })
    }

    return ok({
      exists: true,
      status: latest.status,
      fileName: latest.fileName,
      downloadUrl: buildDownloadUrl(pollId),
      generatedAt: latest.createdAt,
    })
  } catch (err: any) {
    console.error("[GET /api/polls/[pollId]/results]", err)
    return fail("Failed to fetch results status", 500)
  }
}

// POST — generate a new results PDF.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { pollId } = await params

  try {
    const access = await resolvePollAccess(pollId, userId)
    if (!access.ok) return fail(access.error, access.status)

    const d = access.pollSnap.data()!
    const pollEndDate = d.pollEndDate ?? ""
    const pollEndTime = d.pollEndTime ?? ""

    if (!hasPollEnded(pollEndDate, pollEndTime)) {
      return fail(
        `Results can only be generated after the poll ends (${pollEndDate} ${pollEndTime}).`,
        400
      )
    }

    const pollType: "single" | "group" = d.pollType === "group" ? "group" : "single"
    const pollName = d.pollName ?? "Untitled Poll"

    const sections =
      pollType === "group"
        ? buildGroupPollSections(
            await fetchCategoryTree(pollId, { legacyCategories: d.categories ?? [], skipCache: true })
          )
        : buildSinglePollSections(d.contestants, d.pollPrice ?? 0)

    const generatedAt = new Date()
    const pdfBytes = await generatePollResultsPdf({
      pollId,
      pollName,
      pollType,
      generatedAt,
      sections,
    })

    const fileName = buildResultFileName(pollId, generatedAt)
    const storagePath = await uploadPollResultPdf(pollId, fileName, pdfBytes)
    const row = await insertPollResultRow({
      pollId,
      fileName,
      storagePath,
      fileSizeBytes: pdfBytes.byteLength,
      generatedBy: userId,
    })

    return ok({
      status: "ready",
      fileName: row.fileName,
      downloadUrl: buildDownloadUrl(pollId),
      generatedAt: row.createdAt,
    })
  } catch (err: any) {
    console.error("[POST /api/polls/[pollId]/results]", err)
    return fail("Failed to generate results. Please try again.", 500)
  }
}

export async function PATCH()  { return fail("Method Not Allowed", 405) }
export async function DELETE() { return fail("Method Not Allowed", 405) }
