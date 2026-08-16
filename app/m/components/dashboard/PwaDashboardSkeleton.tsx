import { PwaSkelCard, PwaSkelLine } from "../PwaSkeleton"

export function PwaDashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Greeting hero */}
      <PwaSkelCard className="h-40 rounded-3xl sm:h-44" />

      {/* Stats */}
      <div className="space-y-3">
        <PwaSkelLine className="h-3 w-24" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <PwaSkelCard key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PwaSkelCard key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Revenue chart */}
      <PwaSkelCard className="h-64 rounded-2xl" />

      {/* Purchase trend + recent activity */}
      <PwaSkelCard className="h-56 rounded-2xl" />
      <PwaSkelCard className="h-72 rounded-2xl" />

      {/* Events */}
      <div className="space-y-3">
        <PwaSkelLine className="h-3 w-32" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PwaSkelCard key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-3">
        <PwaSkelLine className="h-3 w-28" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <PwaSkelCard key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
