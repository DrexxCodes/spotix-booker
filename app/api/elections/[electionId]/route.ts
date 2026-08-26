/**
 * app/api/elections/[electionId]/route.ts
 *
 * GET   → election + its offices (with questions) + voter count, for the
 * organiser's election dashboard. 403s if the caller isn't this
 * election's organizer.
 * PATCH → currently only adjusts editGraceDays (the candidate edit
 * window) — see lib/election/edit.ts in spotix-vote for how this is
 * consumed. Changing it retroactively extends/shortens the deadline for
 * every candidate already registered, since the deadline is computed
 * from each candidate's own created_at + this value, not stored per row.
 */

import { NextRequest, NextResponse } from "next/server"
import { listOffices, countVoters, updateEditGraceDays } from "@/lib/election-db"
import { requireElectionOwner } from "@/lib/election-auth"

export async function GET(_req: Request, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  const [offices, voterCount] = await Promise.all([listOffices(electionId), countVoters(electionId)])

  return NextResponse.json({ election: access.election, offices, voterCount })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (body.editGraceDays === undefined) {
    return NextResponse.json({ error: "Nothing to update — pass editGraceDays" }, { status: 400 })
  }

  try {
    await updateEditGraceDays(electionId, body.editGraceDays)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to update" }, { status: 500 })
  }
}
