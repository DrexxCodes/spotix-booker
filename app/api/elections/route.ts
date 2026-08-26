/**
 * app/api/elections/route.ts
 *
 * GET  → this organizer's elections
 * POST → create a new election (starts in "draft" — offices, questions,
 *        voter fields, and voter lists are all added afterward from the
 *        election dashboard; the election is moved to "scheduled"/"active"
 *        once the organiser sets it up and the voting window arrives)
 */

import { NextRequest, NextResponse } from "next/server"
import { createElection, listElectionsForOrganizer } from "@/lib/election-db"
import { authenticateElectionRequest } from "@/lib/election-auth"

export async function GET() {
  const auth = await authenticateElectionRequest()
  if (auth instanceof NextResponse) return auth

  try {
    const elections = await listElectionsForOrganizer(auth.userId)
    return NextResponse.json({ elections })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to load elections" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateElectionRequest()
  if (auth instanceof NextResponse) return auth

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { name, description, image, votingStartsAt, votingEndsAt, editGraceDays } = body
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 })
  if (editGraceDays !== undefined && (!Number.isInteger(editGraceDays) || editGraceDays < 0)) {
    return NextResponse.json({ error: "editGraceDays must be a non-negative integer" }, { status: 400 })
  }

  try {
    const election = await createElection({
      organizerId: auth.userId,
      name: name.trim(),
      description,
      image,
      votingStartsAt: votingStartsAt ?? null,
      votingEndsAt: votingEndsAt ?? null,
      editGraceDays: editGraceDays ?? 0,
    })
    return NextResponse.json({ election })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to create election" }, { status: 500 })
  }
}
