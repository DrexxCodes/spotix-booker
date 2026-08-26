/**
 * app/api/elections/[electionId]/tally/route.ts
 *
 * GET → live vote counts per office/candidate, for the ORGANISER's own
 * dashboard only. This is deliberately different from spotix-vote's
 * public tally route: this one is ownership-gated and always returns
 * real numbers, published or not — "stats never visible till Publish
 * Results" is a promise made to voters/the public, not to the
 * organiser watching their own election. Polled every few seconds by
 * the dashboard's live counter + recharts graph.
 */

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { listOffices } from "@/lib/election-db"
import { requireElectionOwner } from "@/lib/election-auth"

export async function GET(_req: Request, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  const offices = await listOffices(electionId)

  const tally = await Promise.all(
    offices.map(async (office: any) => {
      const { data, error } = await supabaseAdmin
        .from("election_candidates")
        .select("id, full_name, vote_count")
        .eq("office_id", office.id)
        .order("vote_count", { ascending: false })
      if (error) throw new Error(error.message)
      return {
        officeId: office.id,
        officeName: office.name,
        candidates: (data ?? []).map((c) => ({ candidateId: c.id, fullName: c.full_name, voteCount: c.vote_count ?? 0 })),
      }
    })
  )

  return NextResponse.json({ tally })
}
