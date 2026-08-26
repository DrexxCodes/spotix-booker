/**
 * app/api/elections/[electionId]/candidates/[candidateId]/bio-data/route.ts
 *
 * GET → { url } — a 10-minute signed URL into the private
 * election-bio-data Supabase Storage bucket, or 404 if this candidate
 * didn't upload one. Ownership-gated the same way as every other
 * /api/elections/[id]/* route (requireElectionOwner), and
 * getCandidateBioDataSignedUrl additionally checks the candidate
 * belongs to this exact election before signing anything.
 */

import { NextRequest, NextResponse } from "next/server"
import { getCandidateBioDataSignedUrl } from "@/lib/election-db"
import { requireElectionOwner } from "@/lib/election-auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ electionId: string; candidateId: string }> }
) {
  const { electionId, candidateId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  try {
    const url = await getCandidateBioDataSignedUrl(electionId, candidateId)
    if (!url) return NextResponse.json({ error: "No bio data document on file for this candidate" }, { status: 404 })
    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to generate a link" }, { status: 500 })
  }
}
