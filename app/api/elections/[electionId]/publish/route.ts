/**
 * app/api/elections/[electionId]/publish/route.ts
 *
 * POST → publishes results. Irreversible (see publishResults in
 * lib/election-db.ts — the update only ever fires once, guarded by
 * .eq("results_published", false)). Requires an explicit
 * { confirm: true } in the body — the Booker UI's confirmation dialog
 * ("this cannot be undone, all users will see results") is what sets
 * this, not a bare button click.
 */

import { NextRequest, NextResponse } from "next/server"
import { publishResults } from "@/lib/election-db"
import { requireElectionOwner } from "@/lib/election-auth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  if (access.election.results_published) {
    return NextResponse.json({ error: "Results have already been published for this election." }, { status: 409 })
  }

  let body: Record<string, any> = {}
  try {
    body = await req.json()
  } catch {
    // no body sent — confirm stays undefined, falls through to the check below
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "Publishing results is irreversible. Resend with { confirm: true } once the organiser has confirmed." },
      { status: 400 }
    )
  }

  try {
    await publishResults(electionId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to publish results" }, { status: 500 })
  }
}
