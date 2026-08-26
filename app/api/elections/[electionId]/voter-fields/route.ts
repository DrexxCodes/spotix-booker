/**
 * app/api/elections/[electionId]/voter-fields/route.ts
 *
 * GET  → the custom fields configured for this election's voter list
 *        (null if not set yet — the Booker UI should block voter list
 *        creation entirely until this returns non-null)
 * POST → sets the field spec. Deliberately a one-time, append-mostly
 *        operation in the UI: changing the spec after voters already
 *        have rows with the old fields creates a real mismatch, so the
 *        dashboard should warn heavily (or just disable this route) once
 *        countVoters(electionId) > 0. Enforced here as a hard block.
 */

import { NextRequest, NextResponse } from "next/server"
import { getVoterFieldsSpec, setVoterFieldsSpec, countVoters, VoterFieldSpec } from "@/lib/election-db"
import { requireElectionOwner } from "@/lib/election-auth"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  const fields = await getVoterFieldsSpec(electionId)
  return NextResponse.json({ fields })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const fields: VoterFieldSpec[] = body.fields
  if (!Array.isArray(fields)) return NextResponse.json({ error: "fields must be an array" }, { status: 400 })
  for (const f of fields) {
    if (!f.key?.trim() || !f.label?.trim()) {
      return NextResponse.json({ error: "Each field needs a key and a label" }, { status: 400 })
    }
  }

  const existingVoterCount = await countVoters(electionId)
  if (existingVoterCount > 0) {
    return NextResponse.json(
      { error: "Voters have already been uploaded for this election — the field spec can't be changed anymore." },
      { status: 409 }
    )
  }

  await setVoterFieldsSpec(electionId, fields)
  return NextResponse.json({ success: true })
}
