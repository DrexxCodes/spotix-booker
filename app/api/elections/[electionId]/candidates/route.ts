/**
 * app/api/elections/[electionId]/candidates/route.ts
 *
 * GET → every candidate registered across all offices, for the
 * organiser's review screen (full name, email, phone, photo, answers,
 * which office, and whether their form was paid via form_reference).
 */

import { NextResponse } from "next/server"
import { listCandidatesForElection } from "@/lib/election-db"
import { requireElectionOwner } from "@/lib/election-auth"

export async function GET(_req: Request, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  const candidates = await listCandidatesForElection(electionId)
  return NextResponse.json({ candidates })
}
