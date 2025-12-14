"use client"

interface EventOption {
  id: string
  name: string
}

interface EventSelectorProps {
  bookerEvents: EventOption[]
  selectedEventId: string | null
  onChange: (eventId: string) => void
}

export default function EventSelector({ bookerEvents, selectedEventId, onChange }: EventSelectorProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <label htmlFor="event-select" className="block text-sm font-semibold text-gray-900 mb-3">
        Select Event
      </label>
      <div className="relative">
        <select
          id="event-select"
          value={selectedEventId || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] bg-white text-gray-900 transition-all duration-200 appearance-none cursor-pointer hover:border-[#6b2fa5]/50"
          required
        >
          <option value="" className="text-gray-500">-- Select an event --</option>
          {bookerEvents.map((event) => (
            <option key={event.id} value={event.id} className="text-gray-900">
              {event.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#6b2fa5]">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  )
}