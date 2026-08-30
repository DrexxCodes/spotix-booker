/**
 * Shared skeleton-loading primitives. Compose these into shapes that match
 * a specific tab's real layout (a row of stat cards, a list of transaction
 * cards, a table, a card grid) instead of a generic centered spinner — see
 * item 5 of the UI renovation ("each tab shall have skeleton loading").
 */

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
}

/** A row of N stat-card-shaped blocks — e.g. Sold/Revenue/Balance cards. */
export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {[...Array(count)].map((_, i) => (
        <SkeletonBlock key={i} className="h-20" />
      ))}
    </div>
  )
}

/** N full-width rows — e.g. transaction days, referral codes, table rows. */
export function SkeletonRows({ count = 4, rowClassName = "h-16" }: { count?: number; rowClassName?: string }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <SkeletonBlock key={i} className={`w-full ${rowClassName}`} />
      ))}
    </div>
  )
}

/** A responsive card grid — e.g. merch listings. */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {[...Array(count)].map((_, i) => (
        <SkeletonBlock key={i} className="h-48" />
      ))}
    </div>
  )
}

/** A data table shape — header bar + N body rows. */
export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <SkeletonBlock className="h-10 w-full" />
      {[...Array(rows)].map((_, i) => (
        <SkeletonBlock key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
