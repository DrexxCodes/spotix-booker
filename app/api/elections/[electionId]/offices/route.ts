/**
 * app/api/elections/[electionId]/offices/route.ts
 *
 * GET  → offices (with their custom questions) for this election
 * POST → create an office: name, optional form fee, and the custom
 *        questions candidates for this office must answer
 */

import { NextRequest, NextResponse } from "next/server"
import { createOffice, listOffices } from "@/lib/election-db"
import { requireElectionOwner } from "@/lib/election-auth"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = await params
  const access = await requireElectionOwner(electionId)
  if (access instanceof NextResponse) return access

  const offices = await listOffices(electionId)
  return NextResponse.json({ offices })
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

  const { name, description, formFee, seatsAvailable, sortOrder, questions, bioDataRequired, bioDataLabel } = body
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 })
  if (formFee !== undefined && (typeof formFee !== "number" || formFee < 0)) {
    return NextResponse.json({ error: "formFee must be a non-negative number" }, { status: 400 })
  }
  if (bioDataRequired && !bioDataLabel?.trim()) {
    return NextResponse.json({ error: "bioDataLabel is required when bioDataRequired is true" }, { status: 400 })
  }

  try {
    const officeId = await createOffice({
      electionId,
      name: name.trim(),
      description,
      formFee: formFee ?? 0,
      seatsAvailable,
      sortOrder,
      questions: Array.isArray(questions) ? questions : [],
      bioDataRequired: !!bioDataRequired,
      bioDataLabel: bioDataLabel?.trim() ?? "",
    })
    return NextResponse.json({ officeId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to create office" }, { status: 500 })
  }
}
