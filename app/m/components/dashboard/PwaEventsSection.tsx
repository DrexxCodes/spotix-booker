"use client"

import { Eye, Calendar, Ticket, ArrowRight } from "lucide-react"
import Link from "next/link"
import { MaskedAmount } from "@/components/ui/masked-amount"

interface Event {
  id: string
  eventName: string
  eventDate: string
  ticketsSold: number
  revenue: number
  availableBalance: number
  status: string
}

function fmtCurrency(n: number) {
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  completed: "bg-blue-50 text-blue-600 border-blue-200",
  past: "bg-amber-50 text-amber-600 border-amber-200",
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.inactive
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "animate-pulse bg-emerald-500" : "bg-current opacity-50"}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export function PwaEventsSection({ events }: { events: Event[] }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="mb-0.5 text-xs font-bold uppercase tracking-wider text-[#1e1330]/40">Recent Events</p>
          <h2 className="text-lg font-bold text-[#1e1330]">Your Events</h2>
        </div>
        <Link
          href="/m/events"
          className="group inline-flex items-center gap-1.5 rounded-lg pwa-glass px-4 py-2 text-sm font-semibold text-[#1e1330]/70 transition-colors hover:text-[#6b2fa5]"
        >
          View All
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="pwa-glass flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6b2fa5]/8">
            <Calendar size={24} className="text-[#6b2fa5]/40" />
          </div>
          <p className="mb-1 font-semibold text-[#1e1330]/70">No events yet</p>
          <p className="mb-5 text-sm text-[#1e1330]/40">Create your first event to start selling tickets</p>
          <Link
            href="/m/create/event"
            className="inline-flex items-center gap-2 rounded-xl bg-[#6b2fa5] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5a2589]"
          >
            Create Event
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <div key={event.id} className="pwa-glass space-y-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold leading-tight text-[#1e1330]">{event.eventName}</p>
                <StatusBadge status={event.status} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-[#6b2fa5]/5 p-2.5">
                  <p className="mb-0.5 text-[#1e1330]/40">Date</p>
                  <p className="font-semibold text-[#1e1330]/80">
                    {new Date(event.eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <div className="rounded-lg bg-[#6b2fa5]/5 p-2.5">
                  <p className="mb-0.5 flex items-center gap-1 text-[#1e1330]/40">
                    <Ticket size={11} /> Tickets
                  </p>
                  <p className="font-semibold text-[#1e1330]/80">{event.ticketsSold.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-[#6b2fa5]/5 p-2.5">
                  <p className="mb-0.5 text-[#1e1330]/40">Revenue</p>
                  <MaskedAmount value={fmtCurrency(event.revenue)} size="sm" className="text-[#1e1330]/80" />
                </div>
                <div className="rounded-lg border border-[#6b2fa5]/15 bg-[#6b2fa5]/8 p-2.5">
                  <p className="mb-0.5 text-[#1e1330]/40">Balance</p>
                  <MaskedAmount value={fmtCurrency(event.availableBalance)} size="sm" className="font-bold text-[#6b2fa5]" />
                </div>
              </div>

              <Link
                href={`/m/events/${event.id}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6b2fa5] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5a2589]"
              >
                <Eye size={14} /> View Details
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
