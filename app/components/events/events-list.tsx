"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { EventCard } from "./event-card"
import { Eye, Calendar, ArrowRight } from "lucide-react"

interface EventData {
  id: string
  eventName: string
  eventDate: string
  eventType: string
  isFree: boolean
  ticketsSold: number
  totalCapacity: number
  revenue: number
  status: "active" | "past" | "draft"
  eventVenue: string
  hasMaxSize: boolean
}

interface EventsListProps {
  events: EventData[]
  searchQuery: string
  statusFilter: string
}

export function EventsList({ events, searchQuery, statusFilter }: EventsListProps) {
  const router = useRouter()
  
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        event.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.eventVenue.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === "all" || event.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [events, searchQuery, statusFilter])

  const statusStyles = {
    active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
    past: "bg-slate-50 text-slate-600 ring-1 ring-slate-500/20",
    draft: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
  }

  if (filteredEvents.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-purple-50/30 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center mb-8">
        <div className="max-w-md mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#6b2fa5]/10 rounded-full mb-6">
            <Eye className="text-[#6b2fa5]" size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">No events found</h3>
          <p className="text-slate-600 mb-6">
            {searchQuery || statusFilter !== "all" 
              ? "Try adjusting your search or filters" 
              : "Create your first event to get started"}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-[#6b2fa5] hover:bg-[#5a2589] text-white font-semibold rounded-lg transition-colors duration-200">
              <Calendar className="w-5 h-5" />
              <span>Create Event</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-12">

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[#6b2fa5] to-purple-600">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-white">Event Name</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-white">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-white">Venue</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-white">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-white">Tickets</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-white">Revenue</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-white">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-white">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((event, index) => (
                  <tr 
                    key={event.id} 
                    className="group hover:bg-[#6b2fa5]/5 transition-colors duration-150 cursor-pointer"
                    onClick={() => router.push(`/event-info/${event.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 group-hover:text-[#6b2fa5] transition-colors">
                        {event.eventName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600">
                        {new Date(event.eventDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 max-w-[200px] truncate">
                        {event.eventVenue}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-md">
                        {event.eventType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {event.hasMaxSize ? (
                          <>
                            <span className="text-sm font-semibold text-slate-900">
                              {event.ticketsSold.toLocaleString()} / {event.totalCapacity.toLocaleString()}
                            </span>
                            <div className="w-20 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-[#6b2fa5] h-1.5 rounded-full transition-all"
                                style={{ width: `${Math.min((event.ticketsSold / event.totalCapacity) * 100, 100)}%` }}
                              />
                            </div>
                          </>
                        ) : (
                          <span className="text-sm font-semibold text-slate-900">
                            {event.ticketsSold.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#6b2fa5]">
                        ₦{event.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[event.status]}`}>
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/event-info/${event.id}`)
                        }}
                        className="inline-flex items-center gap-1.5 text-[#6b2fa5] hover:text-[#5a2589] font-semibold text-sm transition-colors group/btn"
                      >
                        <span>View</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mt-4 text-sm text-slate-600 text-center">
          Showing {filteredEvents.length} of {events.length} total events
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        <div className="space-y-4">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        {/* Mobile Results Summary */}
        <div className="mt-6 text-sm text-slate-600 text-center">
          Showing {filteredEvents.length} of {events.length} total events
        </div>
      </div>
    </div>
  )
}