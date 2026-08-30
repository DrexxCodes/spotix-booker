"use client"

type HistoryValue = unknown
type HistoryChange = { before: HistoryValue; after: HistoryValue }
type HistoryEntry = {
  id: string
  action?: string
  actor?: { uid?: string; type?: string; role?: string }
  changes?: Record<string, HistoryChange>
  reason?: string
  createdAt?: string | null
}

function titleCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function actorLabel(actor?: HistoryEntry["actor"]) {
  if (!actor) return "Unknown actor"
  if (actor.type === "Spotix") return "Spotix"
  if (actor.type === "organizer") return "Organizer"
  if (actor.type === "event_teammate") return actor.role ? titleCase(actor.role) : "Event teammate"
  return actor.role ? titleCase(actor.role) : actor.type || "Unknown actor"
}

function scalarValue(value: HistoryValue) {
  if (value === null || value === undefined || value === "") return "Not set"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}

function isTicketTier(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && ("policy" in value || "price" in value || "availableTickets" in value))
}

function TicketPricesDiff({ before, after }: { before: HistoryValue; after: HistoryValue }) {
  const oldTiers = Array.isArray(before) ? before : []
  const newTiers = Array.isArray(after) ? after : []
  const tiers = Array.from({ length: Math.max(oldTiers.length, newTiers.length) }, (_, index) => ({
    index,
    before: oldTiers[index] as Record<string, unknown> | undefined,
    after: newTiers[index] as Record<string, unknown> | undefined,
  }))
  const fields = ["policy", "description", "price", "availableTickets", "ticketsSold"]

  return (
    <div className="space-y-2">
      {tiers.map(({ index, before: oldTier, after: newTier }) => {
        const changedFields = fields.filter((field) => JSON.stringify(oldTier?.[field]) !== JSON.stringify(newTier?.[field]))
        if (!changedFields.length) return null
        return (
          <div key={index} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tier {index + 1}</p>
            <div className="space-y-2">
              {changedFields.map((field) => (
                <div key={field} className="grid gap-2 text-sm sm:grid-cols-[9rem_1fr]">
                  <span className="font-medium text-slate-600">{titleCase(field)}</span>
                  <div className="min-w-0 space-y-1">
                    <div className="break-words text-slate-400"><span className="mr-2 text-xs uppercase tracking-wide text-slate-400">Before</span>{scalarValue(oldTier?.[field])}</div>
                    <div className="break-words text-slate-900"><span className="mr-2 text-xs uppercase tracking-wide text-emerald-700">After</span>{scalarValue(newTier?.[field])}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChangeDetails({ field, change }: { field: string; change: HistoryChange }) {
  if (field === "ticketPrices" && (Array.isArray(change.before) || Array.isArray(change.after))) {
    return <TicketPricesDiff before={change.before} after={change.after} />
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid gap-2 text-sm sm:grid-cols-[9rem_1fr]">
        <span className="font-medium text-slate-600">{titleCase(field)}</span>
        <div className="min-w-0 space-y-1">
          <div className="break-words text-slate-400"><span className="mr-2 text-xs uppercase tracking-wide text-slate-400">Before</span>{scalarValue(change.before)}</div>
          <div className="break-words text-slate-900"><span className="mr-2 text-xs uppercase tracking-wide text-emerald-700">After</span>{scalarValue(change.after)}</div>
        </div>
      </div>
    </div>
  )
}

export default function EditHistoryTab({ entries = [] }: { entries?: HistoryEntry[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">Edit history</h2>
        <p className="text-sm leading-6 text-slate-500">A read-only record of changes made by the organizer, event teammates, and Spotix.</p>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No edits have been recorded yet.</p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{titleCase(entry.action || "event edit")}</h3>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">{actorLabel(entry.actor)}</span>
                </div>
                <time className="text-xs text-slate-400">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "Pending timestamp"}</time>
              </div>
              {entry.reason && <p className="mt-2 text-sm leading-6 text-slate-600"><span className="font-medium text-slate-700">Reason:</span> {entry.reason}</p>}
              <div className="mt-4 space-y-3">{Object.entries(entry.changes || {}).map(([field, change]) => <ChangeDetails key={field} field={field} change={change} />)}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
