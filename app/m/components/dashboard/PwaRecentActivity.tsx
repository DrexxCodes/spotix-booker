"use client"

import Image from "next/image"
import Link from "next/link"
import { Vote, ListChecks, ImageOff } from "lucide-react"

interface ActivityItem {
  id: string
  kind: "voting" | "nomination"
  pollName: string
  pollImage: string
  status: string
  createdAt: string | null
  linkedEventName: string | null
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function KindPill({ kind }: { kind: ActivityItem["kind"] }) {
  const isVoting = kind === "voting"
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isVoting ? "bg-[#6b2fa5]/10 text-[#6b2fa5]" : "bg-cyan-500/10 text-cyan-600"
      }`}
    >
      {isVoting ? <Vote size={10} /> : <ListChecks size={10} />}
      {isVoting ? "Voting" : "Nomination"}
    </span>
  )
}

export function PwaRecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="pwa-glass rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#1e1330]/40">Recent Activity</p>
          <h3 className="text-sm font-bold text-[#1e1330]">Polls & Nominations</h3>
        </div>
        <Link href="/m/polls" className="text-xs font-semibold text-[#6b2fa5] hover:underline">
          View all
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6b2fa5]/8">
            <Vote size={20} className="text-[#6b2fa5]/40" />
          </div>
          <p className="text-sm text-[#1e1330]/50">No polls or nominations yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={`${item.kind}-${item.id}`}
              href={item.kind === "voting" ? `/m/polls/${item.id}` : `/m/polls/nominations/${item.id}`}
              className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[#6b2fa5]/5"
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#6b2fa5]/8">
                {item.pollImage ? (
                  <Image src={item.pollImage} alt={item.pollName} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#6b2fa5]/30">
                    <ImageOff size={16} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[#1e1330]">{item.pollName || "Untitled"}</p>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <KindPill kind={item.kind} />
                  <span className="text-[11px] text-[#1e1330]/35">{timeAgo(item.createdAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
