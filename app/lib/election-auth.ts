/**
 * lib/election-auth.ts
 *
 * Shared session check for every /api/elections/* route — same
 * spotix_at cookie + verifyAccessToken("spotix-booker") check
 * duplicated inline in app/api/payout/route.ts, pulled into one place
 * here since the elections feature has several route files that all
 * need it.
 */

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyAccessToken } from "@/lib/auth-tokens"
import { getElection } from "@/lib/election-db"

export async function authenticateElectionRequest(): Promise<{ userId: string } | NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get("spotix_at")?.value
  if (!token) return NextResponse.json({ error: "No access token" }, { status: 401 })
  try {
    const payload = await verifyAccessToken(token, "spotix-booker")
    return { userId: payload.uid }
  } catch {
    return NextResponse.json({ error: "Invalid or expired access token" }, { status: 401 })
  }
}

/**
 * Combined auth + ownership check reused by every /api/elections/{id}/*
 * sub-route (offices, voter-fields, voters, candidates, publish, tally,
 * payout). Returns the election row itself so callers don't have to
 * re-fetch it.
 */
export async function requireElectionOwner(electionId: string) {
  const auth = await authenticateElectionRequest()
  if (auth instanceof NextResponse) return auth

  const election = await getElection(electionId)
  if (!election) return NextResponse.json({ error: "Election not found" }, { status: 404 })
  if (election.organizer_id !== auth.userId) {
    return NextResponse.json({ error: "You don't have access to this election" }, { status: 403 })
  }
  return { userId: auth.userId, election }
}
