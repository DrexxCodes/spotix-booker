"use client"

/**
 * Category Subcollection Migration Page
 * ─────────────────────────────────────────────────────────────────────────────
 * Moves a group poll's legacy `categories` array field (on the
 * voting/{pollId} doc) into the new voting/{pollId}/categories
 * SUBCOLLECTION — see app/lib/poll-categories.ts for why.
 *
 * Leave "Poll ID" blank to migrate every group poll that still has a
 * populated categories array. Fill it in to migrate just one poll —
 * recommended for the first real (non-dry) run, to sanity-check a
 * single poll's result before turning it loose on everything.
 *
 * Run dry first, confirm the summary looks right, then run for real.
 * Safe to re-run — every poll's subcollection is fully rewritten from
 * its array each time, keyed on the same categoryIds already in it.
 * Note this DOES write (unlike migrate-nominations, which only reads
 * Firestore) — it clears each migrated poll's legacy array field once
 * its subcollection is populated, which is the whole point (that field
 * being enormous is what broke the Firestore console in the first
 * place), but it does mean a real run is a one-way trip for that field.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react"

interface MigrationLog {
  type: "info" | "success" | "warn" | "error"
  message: string
}

interface MigrationResult {
  pollsScanned: number
  pollsMigrated: number
  pollsSkippedAlreadyMigrated: number
  categoryNodesMigrated: number
  errors: string[]
}

export default function MigrateCategoriesPage() {
  const [running, setRunning] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [migrationKey, setMigrationKey] = useState("")
  const [pollId, setPollId] = useState("")
  const [logs, setLogs] = useState<MigrationLog[]>([])
  const [result, setResult] = useState<MigrationResult | null>(null)

  const addLog = (type: MigrationLog["type"], message: string) => {
    setLogs((prev) => [...prev, { type, message }])
  }

  const runMigration = async () => {
    if (!migrationKey.trim()) {
      addLog("error", "Enter the migration key first (MIGRATION_SECRET_KEY on the server).")
      return
    }

    setRunning(true)
    setLogs([])
    setResult(null)

    try {
      addLog("info", `Starting migration — dry run: ${dryRun}${pollId.trim() ? `, pollId: ${pollId.trim()}` : " (all group polls)"}`)

      const res = await fetch("/api/admin/migrate-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, migrationKey, pollId: pollId.trim() || undefined }),
      })

      const data = await res.json()

      if (data.logs && Array.isArray(data.logs)) {
        for (const log of data.logs) {
          addLog(log.type, log.message)
        }
      }

      if (!res.ok) {
        addLog("error", `Migration API error: ${data.error || res.statusText}`)
        if (data.result) setResult(data.result)
        return
      }

      setResult(data.result)
      addLog("success", "Migration complete!")
    } catch (err: any) {
      addLog("error", `Unexpected error: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  const logColor: Record<MigrationLog["type"], string> = {
    info: "text-gray-700",
    success: "text-green-700",
    warn: "text-yellow-700",
    error: "text-red-700",
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Category Subcollection Migration</h1>
          <p className="text-gray-600 mb-6">
            Moves group polls' <code className="bg-gray-100 px-1 rounded">categories</code> array field into{" "}
            <code className="bg-gray-100 px-1 rounded">voting/&#123;pollId&#125;/categories</code> — one document
            per category node instead of one giant nested array on the poll doc.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Migration key</label>
            <input
              type="password"
              value={migrationKey}
              onChange={(e) => setMigrationKey(e.target.value)}
              placeholder="MIGRATION_SECRET_KEY"
              disabled={running}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must match <code className="bg-gray-100 px-1 rounded">MIGRATION_SECRET_KEY</code> set
              in this app's environment variables.
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Poll ID (optional)</label>
            <input
              type="text"
              value={pollId}
              onChange={(e) => setPollId(e.target.value)}
              placeholder="Leave blank to migrate every group poll"
              disabled={running}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Recommended: migrate one poll first, check the result, then leave this blank for the rest.
            </p>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-4 h-4"
                disabled={running}
              />
              <span className="font-medium text-gray-700">Dry run (no writes)</span>
            </label>
            {!dryRun && (
              <span className="text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                ⚠ LIVE MODE — writes subcollection docs and clears each poll's legacy array field
              </span>
            )}
          </div>

          <button
            onClick={runMigration}
            disabled={running}
            className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? "Running…" : dryRun ? "Run Dry Migration" : "Run Migration"}
          </button>
        </div>

        {/* Result Summary */}
        {result && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-500">Polls scanned</p>
                <p className="text-2xl font-bold text-gray-900">{result.pollsScanned}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-gray-500">Polls migrated</p>
                <p className="text-2xl font-bold text-green-700">{result.pollsMigrated}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-500">Already migrated</p>
                <p className="text-2xl font-bold text-gray-900">{result.pollsSkippedAlreadyMigrated}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-gray-500">Category nodes migrated</p>
                <p className="text-2xl font-bold text-green-700">{result.categoryNodesMigrated}</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-4 bg-red-50 rounded-xl p-4">
                <p className="font-semibold text-red-700 mb-2">Errors ({result.errors.length})</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-sm text-red-600">{e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Log Output */}
        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-2xl shadow-lg p-6 font-mono text-sm max-h-[500px] overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className={`mb-1 ${logColor[log.type]} ${log.type === "error" ? "font-bold" : ""}`}>
                <span className="text-gray-500 mr-2">[{String(i).padStart(4, "0")}]</span>
                {log.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
