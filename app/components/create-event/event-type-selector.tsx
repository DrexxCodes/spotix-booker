"use client"

import { Calendar, Repeat1 as Repeat3 } from "lucide-react"

interface EventTypeSelectorProps {
  onSelect: (type: "one-time" | "event-group") => void
}

export function EventTypeSelector({ onSelect }: EventTypeSelectorProps) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-foreground">Create an Event</h1>
        <p className="text-lg text-muted-foreground">Choose the type of event you'd like to create</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* One-Off Event Card */}
        <button
          onClick={() => onSelect("one-time")}
          className="group relative overflow-hidden rounded-lg border-2 border-border bg-card p-8 transition-all duration-300 hover:border-[#6b2fa5] hover:shadow-lg hover:shadow-[#6b2fa5]/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#6b2fa5]/0 to-[#6b2fa5]/0 group-hover:from-[#6b2fa5]/5 group-hover:to-[#6b2fa5]/10 transition-all duration-300"></div>

          <div className="relative space-y-4">
            <div className="inline-flex rounded-lg bg-[#6b2fa5]/10 p-3 text-[#6b2fa5] group-hover:bg-[#6b2fa5] group-hover:text-white transition-all duration-300">
              <Calendar size={28} />
            </div>

            <div className="text-left">
              <h2 className="text-2xl font-bold text-foreground mb-3">One-Off Event</h2>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Perfect for events that happen only once with no variations</p>

                <ul className="space-y-2 mt-4 pt-4 border-t border-border">
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Single date and time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Uniform ticket pricing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Simple setup and management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Best for one-time occasions</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 font-semibold text-[#6b2fa5] group-hover:gap-3 transition-all">
              Get Started <span>→</span>
            </div>
          </div>
        </button>

        {/* Event Group Card */}
        <button
          onClick={() => onSelect("event-group")}
          className="group relative overflow-hidden rounded-lg border-2 border-border bg-card p-8 transition-all duration-300 hover:border-[#6b2fa5] hover:shadow-lg hover:shadow-[#6b2fa5]/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#6b2fa5]/0 to-[#6b2fa5]/0 group-hover:from-[#6b2fa5]/5 group-hover:to-[#6b2fa5]/10 transition-all duration-300"></div>

          <div className="relative space-y-4">
            <div className="inline-flex rounded-lg bg-[#6b2fa5]/10 p-3 text-[#6b2fa5] group-hover:bg-[#6b2fa5] group-hover:text-white transition-all duration-300">
              <Repeat3 size={28} />
            </div>

            <div className="text-left">
              <h2 className="text-2xl font-bold text-foreground mb-3">Event Group</h2>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>For recurring events with variations that happen multiple times</p>

                <ul className="space-y-2 mt-4 pt-4 border-t border-border">
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Multiple dates and variations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Yearly, monthly, or quarterly recurrence</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Flexible pricing per instance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Manage series collectively</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 font-semibold text-[#6b2fa5] group-hover:gap-3 transition-all">
              Get Started <span>→</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
