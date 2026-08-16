import { LucideIcon } from "lucide-react"
import { PwaSkelCard, PwaSkelLine } from "./PwaSkeleton"

export function PwaComingSoon({
  icon: Icon,
  title,
  phase,
  blurb,
}: {
  icon: LucideIcon
  title: string
  phase: string
  blurb: string
}) {
  return (
    <div className="space-y-4">
      <div className="pwa-glass-strong flex items-center gap-3 rounded-2xl p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6b2fa5]/10 text-[#6b2fa5]">
          <Icon size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1e1330]">{title}</p>
          <p className="text-xs text-[#1e1330]/50">{phase} · {blurb}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="pwa-glass rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-3">
              <PwaSkelCard className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <PwaSkelLine className="w-3/4" />
                <PwaSkelLine className="w-1/2" />
              </div>
            </div>
            <PwaSkelLine className="w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
