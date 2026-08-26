/**
 * app/api/elections/[electionId]/offices/[officeId]/route.ts
 *
 * PATCH  → edit an office's name/fee/seats/questions/bio-data config
 * DELETE → remove an office (blocked once it has any registered
 *          candidates — see deleteOffice in lib/election-db.ts)
 */

import { NextRequest, NextResponse } from "next/server"
import { updateOffice, deleteOffice, getOffice } from "@/lib/election-db"
import { requireElectionOwner } from "@/lib/election-auth"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ electionId: string; officeId: string }> }) {
  const { electionId, officeId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  const office = await getOffice(officeId)
  if (!office || office.election_id !== electionId) {
    return NextResponse.json({ error: "Office not found for this election" }, { status: 404 })
  }

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { name, description, formFee, seatsAvailable, sortOrder, questions, bioDataRequired, bioDataLabel } = body

  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: "name cannot be empty" }, { status: 400 })
  }
  if (formFee !== undefined && (typeof formFee !== "number" || formFee < 0)) {
    return NextResponse.json({ error: "formFee must be a non-negative number" }, { status: 400 })
  }
  if (bioDataRequired && !(bioDataLabel ?? office.bio_data_label)?.trim()) {
    return NextResponse.json({ error: "bioDataLabel is required when bioDataRequired is true" }, { status: 400 })
  }

  try {
    await updateOffice(officeId, {
      name: name?.trim(),
      description,
      formFee,
      seatsAvailable,
      sortOrder,
      bioDataRequired,
      bioDataLabel: bioDataLabel?.trim(),
      questions: Array.isArray(questions) ? questions : undefined,
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to update office" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ electionId: string; officeId: string }> }) {
  const { electionId, officeId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  const office = await getOffice(officeId)
  if (!office || office.election_id !== electionId) {
    return NextResponse.json({ error: "Office not found for this election" }, { status: 404 })
  }

  try {
    const result = await deleteOffice(officeId)
    if (!result.ok) {
      return NextResponse.json(
        { error: "This office already has registered candidates and can't be deleted — edit it instead." },
        { status: 409 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to delete office" }, { status: 500 })
  }
}
