"use client"

import { useRouter } from "next/navigation"
import { BarChart3, MapPin, Calendar, ArrowRight } from "lucide-react"

interface EventData {
  id: string
  eventName: string
  eventDate: string
  eventType: string
  ticketsSold: number
  totalCapacity: number
  revenue: number
  status: "active" | "past" | "draft"
  eventVenue: string
  hasMaxSize: boolean
}

interface EventCardProps {
  event: EventData
  isCollaborated?: boolean
  role?: string
}

export function EventCard({ event, isCollaborated, role }: EventCardProps) {
  const router = useRouter()
  const ticketPercentage = event.hasMaxSize ? (event.ticketsSold / event.totalCapacity) * 100 : 0

  const statusStyles = {
    active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
    past: "bg-slate-50 text-slate-600 ring-1 ring-slate-500/20",
    draft: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
  }

  return (
    <div className="group relative bg-white border border-slate-200 rounded-xl p-6 hover:border-[#6b2fa5] hover:shadow-xl hover:shadow-[#6b2fa5]/10 transition-all duration-300 cursor-pointer">
      {/* Gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#6b2fa5] via-purple-400 to-[#6b2fa5] rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-2 group-hover:text-[#6b2fa5] transition-colors duration-200">
            {event.eventName}
          </h3>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="w-4 h-4 flex-shrink-0 text-[#6b2fa5]" />
            <span className="truncate">{event.eventVenue}</span>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${statusStyles[event.status]}`}>
          {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
        </span>
      </div>

      {/* Date */}
      <div className="flex items-center gap-2 text-sm text-slate-600 mb-6 bg-slate-50 rounded-lg px-3 py-2.5">
        <Calendar className="w-4 h-4 text-[#6b2fa5]" />
        <span className="font-medium">{new Date(event.eventDate).toLocaleDateString('en-US', { 
          weekday: 'short', 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })}</span>
      </div>

      {/* Tickets Section */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Ticket Sales</span>
          <div className="text-right">
            <span className="font-bold text-slate-900 text-lg">
              {event.ticketsSold.toLocaleString()}
            </span>
            {event.hasMaxSize && (
              <span className="text-sm text-slate-500 ml-1">
                / {event.totalCapacity.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {event.hasMaxSize && (
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#6b2fa5] to-purple-400 h-2.5 rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${Math.min(ticketPercentage, 100)}%` }} 
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{ticketPercentage.toFixed(0)}% sold</span>
              {ticketPercentage >= 90 && (
                <span className="text-[#6b2fa5] font-semibold">Almost full!</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Revenue Section */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-br from-[#6b2fa5]/5 to-purple-50 rounded-lg border border-[#6b2fa5]/10 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#6b2fa5] rounded-lg">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-slate-700">Total Revenue</span>
        </div>
        <span className="font-bold text-[#6b2fa5] text-xl">₦{event.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
        {isCollaborated && role ? (
          <span className="inline-flex items-center text-xs font-bold text-[#6b2fa5] bg-[#6b2fa5]/10 px-3 py-1.5 rounded-full ring-1 ring-[#6b2fa5]/20">
            {role.toUpperCase()}
          </span>
        ) : (
          <div />
        )}
        <button
          onClick={() => router.push(`/event-info/${event.id}`)}
          className="ml-auto inline-flex items-center gap-2 text-[#6b2fa5] hover:text-[#5a2589] font-semibold text-sm transition-all duration-200 group/btn"
        >
          <span>View Details</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
        </button>
      </div>
    </div>
  )
}