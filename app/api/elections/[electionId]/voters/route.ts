/**
 * app/api/elections/[electionId]/voters/route.ts
 *
 * GET  → list voters uploaded so far
 * POST → upload voters, either:
 *   { mode: "csv", csvText: "..." }
 *   { mode: "manual", voters: [{ email, name, phone, meta }] }
 *
 * Both paths are validated against this election's voter_fields spec
 * (lib/election-voters-csv.ts) BEFORE anything is inserted — the spec
 * must already exist (see /voter-fields), and a manual entry missing a
 * required custom field is rejected exactly like a CSV missing that
 * column would be.
 */

import { NextRequest, NextResponse } from "next/server"
import { addVoters, getVoterFieldsSpec, listVoters } from "@/lib/election-db"
import { parseAndValidateVotersCsv, validateManualVoter, buildRejectedRowsCsv } from "@/lib/election-voters-csv"
import { requireElectionOwner } from "@/lib/election-auth"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  const voters = await listVoters(electionId)
  return NextResponse.json({ voters })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  const fieldSpec = await getVoterFieldsSpec(electionId)
  if (fieldSpec === null) {
    return NextResponse.json(
      { error: "Set this election's voter-list custom fields first, before uploading any voters." },
      { status: 409 }
    )
  }

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (body.mode === "csv") {
    if (!body.csvText?.trim()) return NextResponse.json({ error: "csvText is required" }, { status: 400 })

    const result = parseAndValidateVotersCsv(body.csvText, fieldSpec)
    if (!result.ok) {
      // Structural failure only — missing column(s), or the file didn't
      // parse at all. Nothing to salvage here, unlike per-row problems.
      return NextResponse.json({ error: "CSV validation failed", details: result.errors }, { status: 422 })
    }

    try {
      const { inserted, skipped } = await addVoters(electionId, result.voters)
      const rejectedRowsCsv = buildRejectedRowsCsv(result.rejectedRows)
      return NextResponse.json({
        inserted,
        skipped,
        rejectedCount: result.rejectedRows.length,
        // Valid rows are always inserted regardless of any rejected rows —
        // the organiser fixes and re-uploads just this CSV, not the whole file.
        rejectedRowsCsv: rejectedRowsCsv || null,
      })
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? "Failed to add voters" }, { status: 500 })
    }
  }

  if (body.mode === "manual") {
    if (!Array.isArray(body.voters) || body.voters.length === 0) {
      return NextResponse.json({ error: "voters must be a non-empty array" }, { status: 400 })
    }

    const allErrors: string[] = []
    body.voters.forEach((v: any, i: number) => {
      const errs = validateManualVoter(v, fieldSpec)
      errs.forEach((e) => allErrors.push(`Entry ${i + 1}: ${e}`))
    })
    if (allErrors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: allErrors }, { status: 422 })
    }

    try {
      const { inserted, skipped } = await addVoters(electionId, body.voters)
      return NextResponse.json({ inserted, skipped })
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? "Failed to add voters" }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'mode must be "csv" or "manual"' }, { status: 400 })
}
