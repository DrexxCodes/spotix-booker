import React from "react"
import { Calendar, AlertCircle } from "lucide-react"

interface EventDateTimeProps {
  eventDate: string
  setEventDate: (value: string) => void
  eventStart: string
  setEventStart: (value: string) => void
  eventEndDate: string
  setEventEndDate: (value: string) => void
  eventEnd: string
  setEventEnd: (value: string) => void
  getMinDate: () => string
  validateEndDateTime: () => boolean
}

export function EventDateTime({
  eventDate,
  setEventDate,
  eventStart,
  setEventStart,
  eventEndDate,
  setEventEndDate,
  eventEnd,
  setEventEnd,
  getMinDate,
  validateEndDateTime,
}: EventDateTimeProps) {
  return (
    <div className="space-y-6 rounded-xl border-2 border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 bg-[#6b2fa5]/10 rounded-lg">
          <Calendar className="w-5 h-5 text-[#6b2fa5]" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Date & Time</h2>
      </div>

      <div className="space-y-6">
        {/* Event Start Section */}
        <div className="p-5 rounded-lg border-2 border-slate-200 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            Event Start
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                min={getMinDate()}
                required
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1">
                Event must be at least 2 days from today
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={eventStart}
                onChange={(e) => setEventStart(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Event End Section */}
        <div className="p-5 rounded-lg border-2 border-slate-200 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            Event End
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={eventEndDate}
                onChange={(e) => setEventEndDate(e.target.value)}
                min={eventDate || getMinDate()}
                disabled={!eventDate || !eventStart}
                required
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
              />
              {(!eventDate || !eventStart) && (
                <p className="text-xs text-amber-600 mt-1">
                  Set start date and time first
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={eventEnd}
                onChange={(e) => setEventEnd(e.target.value)}
                disabled={!eventDate || !eventStart}
                required
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
              />
              {(!eventDate || !eventStart) && (
                <p className="text-xs text-amber-600 mt-1">
                  Set start date and time first
                </p>
              )}
            </div>
          </div>
          {eventEndDate &&
            eventEnd &&
            eventDate &&
            eventStart &&
            !validateEndDateTime() && (
              <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-800">
                  End date and time must be after start date and time
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}