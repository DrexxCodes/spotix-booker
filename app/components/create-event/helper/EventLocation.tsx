import React from "react"
import { MapPin, MapPinned, CheckCircle } from "lucide-react"

interface EventLocationProps {
  eventVenue: string
  setEventVenue: (value: string) => void
  venueCoordinates: { lat: number; lng: number } | null
  setVenueCoordinates: (coords: { lat: number; lng: number } | null) => void
  onOpenMapPicker: () => void
}

export function EventLocation({
  eventVenue,
  setEventVenue,
  venueCoordinates,
  onOpenMapPicker,
}: EventLocationProps) {
  return (
    <div className="space-y-6 rounded-xl border-2 border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 bg-[#6b2fa5]/10 rounded-lg">
          <MapPin className="w-5 h-5 text-[#6b2fa5]" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Location</h2>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Event Venue <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Enter event venue or address"
              value={eventVenue}
              onChange={(e) => setEventVenue(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900"
            />
          </div>
          <button
            type="button"
            onClick={onOpenMapPicker}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#6b2fa5] hover:bg-[#5a2589] text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
          >
            <MapPinned className="w-5 h-5" />
            Pick on Map
          </button>
        </div>
        {venueCoordinates && (
          <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            Location coordinates saved
          </p>
        )}
      </div>
    </div>
  )
}