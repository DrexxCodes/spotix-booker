/**
 * lib/election-voters-csv.ts
 *
 * Parses an uploaded voter-list CSV and validates it against the
 * election's configured custom fields (election_voter_fields — see
 * lib/election-db.ts#getVoterFieldsSpec).
 *
 * Missing REQUIRED COLUMNS (the whole CSV lacks a column the field spec
 * needs) still rejects the entire upload up front — there's no way to
 * partially salvage a file that's structurally missing a field.
 *
 * Per-ROW problems (a blank email, a missing required value on one
 * line) no longer reject the whole file: valid rows are inserted, and
 * invalid ones come back as `rejectedRows` — original row data plus the
 * reason — so the caller (see app/api/elections/[id]/voters/route.ts)
 * can hand the organiser a re-downloadable CSV of just the rows that
 * need fixing, instead of forcing them to fix one typo and re-upload
 * all 2,000 rows again.
 *
 * Required base columns on every CSV, regardless of custom fields:
 *   email, name
 * Everything else in the organiser's field spec is looked up by its
 * `key` as an additional CSV column.
 *
 * New dependency: papaparse (see package.json diff / CHANGELOG).
 */

import Papa from "papaparse"
import type { VoterFieldSpec, VoterInput } from "@/lib/election-db"

export interface RejectedRow {
  rowNum: number
  original: Record<string, string>
  reason: string
}

export interface CsvValidationResult {
  /** false only for a structural problem (missing column) — the whole file is rejected. */
  ok: boolean
  voters: VoterInput[]
  rejectedRows: RejectedRow[]
  /** Structural/file-level errors only (missing columns, unparsable CSV). Empty when ok is true. */
  errors: string[]
}

const BASE_COLUMNS = ["email", "name"]

export function parseAndValidateVotersCsv(csvText: string, fieldSpec: VoterFieldSpec[]): CsvValidationResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  if (parsed.errors.length > 0) {
    return { ok: false, voters: [], rejectedRows: [], errors: parsed.errors.map((e) => `Row ${e.row}: ${e.message}`) }
  }

  const headers = parsed.meta.fields?.map((f) => f.toLowerCase()) ?? []
  const requiredKeys = [...BASE_COLUMNS, ...fieldSpec.map((f) => f.key.toLowerCase())]
  const missingColumns = requiredKeys.filter((key) => !headers.includes(key))

  if (missingColumns.length > 0) {
    return {
      ok: false,
      voters: [],
      rejectedRows: [],
      errors: [`CSV is missing required column(s): ${missingColumns.join(", ")}. Every upload must include the custom fields configured for this election.`],
    }
  }

  const voters: VoterInput[] = []
  const rejectedRows: RejectedRow[] = []

  parsed.data.forEach((row, i) => {
    const rowNum = i + 2 // header is row 1
    const email = row.email?.trim()
    const name = row.name?.trim()

    if (!email) {
      rejectedRows.push({ rowNum, original: row, reason: "Missing email" })
      return
    }
    if (!name) {
      rejectedRows.push({ rowNum, original: row, reason: "Missing name" })
      return
    }

    const meta: Record<string, string> = {}
    let missingField: string | null = null
    for (const field of fieldSpec) {
      const value = row[field.key.toLowerCase()]?.trim() ?? ""
      if (field.required && !value) {
        missingField = field.label
        break
      }
      meta[field.key] = value
    }
    if (missingField) {
      rejectedRows.push({ rowNum, original: row, reason: `Missing required field "${missingField}"` })
      return
    }

    voters.push({ email, name, phone: row.phone?.trim() ?? "", meta })
  })

  return { ok: true, voters, rejectedRows, errors: [] }
}

/** Builds a re-downloadable CSV of just the rejected rows, with a Reason column appended. */
export function buildRejectedRowsCsv(rejectedRows: RejectedRow[]): string {
  if (rejectedRows.length === 0) return ""
  const columns = Array.from(new Set(rejectedRows.flatMap((r) => Object.keys(r.original))))
  return Papa.unparse({
    fields: [...columns, "reason"],
    data: rejectedRows.map((r) => [...columns.map((c) => r.original[c] ?? ""), r.reason]),
  })
}

/** Used by the "manual entry" path — same field-spec enforcement, no CSV parsing involved. */
export function validateManualVoter(
  voter: { email: string; name: string; phone?: string; meta?: Record<string, string> },
  fieldSpec: VoterFieldSpec[]
): string[] {
  const errors: string[] = []
  if (!voter.email?.trim()) errors.push("Email is required")
  if (!voter.name?.trim()) errors.push("Name is required")
  for (const field of fieldSpec) {
    if (field.required && !voter.meta?.[field.key]?.trim()) {
      errors.push(`"${field.label}" is required`)
    }
  }
  return errors
}
