"use client"

/**
 * app/elections/[electionId]/components/VotersTab.tsx
 *
 * Two-stage flow, enforced by the API itself (not just the UI):
 *   1. Configure the custom fields this voter list needs (once — see
 *      /api/elections/[id]/voter-fields, blocked after any voter exists)
 *   2. Upload voters — CSV (which must contain those fields as columns,
 *      plus email/name) or manual entry (same fields required per row)
 */

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "../../components/Skeleton"

interface FieldSpec {
  key: string
  label: string
  required: boolean
}

export function VotersTab({ electionId }: { electionId: string }) {
  const [fields, setFields] = useState<FieldSpec[] | null>(null)
  const [loadingFields, setLoadingFields] = useState(true)
  const [voters, setVoters] = useState<any[]>([])
  const [uploadResult, setUploadResult] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string[] | null>(null)
  const [rejectedRowsCsv, setRejectedRowsCsv] = useState<string | null>(null)

  function loadFields() {
    setLoadingFields(true)
    fetch(`/api/elections/${electionId}/voter-fields`)
      .then((r) => r.json())
      .then((d) => setFields(d.fields))
      .finally(() => setLoadingFields(false))
  }
  function loadVoters() {
    fetch(`/api/elections/${electionId}/voters`)
      .then((r) => r.json())
      .then((d) => setVoters(d.voters ?? []))
  }

  useEffect(() => {
    loadFields()
    loadVoters()
  }, [electionId])

  if (loadingFields) {
    return (
      <div>
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="mt-4 h-10 w-40 rounded-2xl" />
      </div>
    )
  }

  if (fields === null) {
    return <FieldSpecSetup electionId={electionId} onSaved={loadFields} />
  }

  async function handleCsvUpload(file: File) {
    const csvText = await file.text()
    setUploadResult(null)
    setErrorDetails(null)
    setRejectedRowsCsv(null)
    const res = await fetch(`/api/elections/${electionId}/voters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "csv", csvText }),
    })
    const data = await res.json()
    if (!res.ok) {
      // Only reaches here for a structural problem (missing column) —
      // per-row issues no longer fail the whole upload, see below.
      setErrorDetails(data.details ?? [data.error])
      return
    }
    const skippedNote = data.skipped.length > 0 ? `, ${data.skipped.length} already existed` : ""
    const rejectedNote = data.rejectedCount > 0 ? `, ${data.rejectedCount} row(s) had problems — download them below to fix and re-upload` : ""
    setUploadResult(`${data.inserted} voter(s) added${skippedNote}${rejectedNote}.`)
    if (data.rejectedRowsCsv) setRejectedRowsCsv(data.rejectedRowsCsv)
    loadVoters()
  }

  function csvCell(value: string) {
    // Quote any cell that needs it (comma, quote, or newline), doubling internal quotes.
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  }

  function downloadTemplate() {
    const columns = ["email", "name", ...(fields ?? []).map((f) => f.key)]
    const exampleRow = ["voter@example.com", "Jane Doe", ...(fields ?? []).map((f) => (f.required ? `example ${f.label || f.key}` : ""))]
    const csv = [columns.map(csvCell).join(","), exampleRow.map(csvCell).join(",")].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "voters-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadRejectedRows() {
    if (!rejectedRowsCsv) return
    const blob = new Blob([rejectedRowsCsv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "rejected-voter-rows.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="rounded-2xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700">Required fields for this election's voter list</p>
        <p className="mt-1 text-xs text-gray-500">
          email, name{fields.length > 0 && `, ${fields.map((f) => f.key).join(", ")}`} — every CSV upload must include these columns.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-2xl bg-[#6b2fa5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5b2490]">
          Upload CSV
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])}
          />
        </label>
        <button
          onClick={downloadTemplate}
          className="rounded-2xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-[#6b2fa5] hover:text-[#6b2fa5]"
        >
          Download CSV template
        </button>
        <span className="text-xs text-gray-500">Columns: email, name{fields.length > 0 && `, ${fields.map((f) => f.key).join(", ")}`}</span>
      </div>

      {uploadResult && <p className="mt-3 text-sm text-green-700">{uploadResult}</p>}
      {rejectedRowsCsv && (
        <button onClick={downloadRejectedRows} className="mt-1 text-sm text-[#6b2fa5] underline">
          Download rejected rows CSV
        </button>
      )}
      {errorDetails && (
        <ul className="mt-3 list-disc pl-5 text-sm text-red-600">
          {errorDetails.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <p className="text-sm font-medium text-gray-700">{voters.length} voter(s) uploaded</p>
        <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-gray-100">
          {voters.map((v) => (
            <li key={v.id} className="py-2 text-sm text-gray-700">
              {v.name} · {v.email}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function FieldSpecSetup({ electionId, onSaved }: { electionId: string; onSaved: () => void }) {
  const [fields, setFields] = useState<FieldSpec[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addField() {
    setFields((f) => [...f, { key: "", label: "", required: true }])
  }
  function updateField(i: number, patch: Partial<FieldSpec>) {
    setFields((f) => f.map((item, idx) => (idx === i ? { ...item, ...patch } : item)))
  }
  function removeField(i: number) {
    setFields((f) => f.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/elections/${electionId}/voter-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to save")
      onSaved()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-900">Before uploading any voters, specify the extra fields you'll need</p>
      <p className="mt-1 text-xs text-gray-500">Every voter list already includes email and name — add any extras (e.g. matric number, department).</p>

      <div className="mt-4 flex flex-col gap-2">
        {fields.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              placeholder="key (e.g. matric_no)"
              value={f.key}
              onChange={(e) => updateField(i, { key: e.target.value })}
              className="w-32 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#6b2fa5]"
            />
            <input
              placeholder="Label shown on CSV"
              value={f.label}
              onChange={(e) => updateField(i, { label: e.target.value })}
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#6b2fa5]"
            />
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
              Required
            </label>
            <button onClick={() => removeField(i)} className="text-xs text-red-500">
              Remove
            </button>
          </div>
        ))}
        <button onClick={addField} className="self-start text-xs text-[#6b2fa5]">
          + Add field
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : fields.length === 0 ? "No extra fields needed — continue" : "Save fields & continue"}
        </Button>
      </div>
    </div>
  )
}
