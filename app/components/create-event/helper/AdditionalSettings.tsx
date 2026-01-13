import React from "react"
import { Settings, AlertCircle } from "lucide-react"

interface AdditionalSettingsProps {
  enableStopDate: boolean
  setEnableStopDate: (value: boolean) => void
  stopDate: string
  setStopDate: (value: string) => void
  eventDate: string
  getMaxStopDate: () => string
  validateStopDate: () => boolean
  enabledCollaboration: boolean
  setEnabledCollaboration: (value: boolean) => void
  allowAgents: boolean
  setAllowAgents: (value: boolean) => void
}

export function AdditionalSettings({
  enableStopDate,
  setEnableStopDate,
  stopDate,
  setStopDate,
  eventDate,
  getMaxStopDate,
  validateStopDate,
  enabledCollaboration,
  setEnabledCollaboration,
  allowAgents,
  setAllowAgents,
}: AdditionalSettingsProps) {
  return (
    <div className="space-y-6 rounded-xl border-2 border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 bg-[#6b2fa5]/10 rounded-lg">
          <Settings className="w-5 h-5 text-[#6b2fa5]" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Additional Settings</h2>
      </div>

      <div className="space-y-6">
        {/* Stop Date Toggle */}
        <div className="p-5 rounded-lg border-2 border-slate-200 hover:border-[#6b2fa5]/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <label className="text-sm font-semibold text-slate-900 block mb-1">
                Enable Stop Date for Ticket Sales
              </label>
              <p className="text-xs text-slate-600">
                Set a deadline for when ticket sales should stop
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableStopDate}
                onChange={(e) => {
                  setEnableStopDate(e.target.checked)
                  if (!e.target.checked) {
                    setStopDate("")
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#6b2fa5]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6b2fa5]"></div>
            </label>
          </div>
          {enableStopDate && (
            <div className="space-y-3">
              <input
                type="datetime-local"
                value={stopDate}
                onChange={(e) => setStopDate(e.target.value)}
                max={getMaxStopDate()}
                disabled={!eventDate}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              {eventDate && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    Stop date must be at least 3 days before event start date. Maximum
                    date: {new Date(getMaxStopDate()).toLocaleDateString()}
                  </p>
                </div>
              )}
              {stopDate && eventDate && !validateStopDate() && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">
                    Stop date must be at least 3 days before the event start date
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collaboration Toggle */}
        <div className="p-5 rounded-lg border-2 border-slate-200 hover:border-[#6b2fa5]/30 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <label className="text-sm font-semibold text-slate-900 block mb-1">
                Enable Collaboration
              </label>
              <p className="text-xs text-slate-600">
                Allow team members to help manage this event
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabledCollaboration}
                onChange={(e) => setEnabledCollaboration(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#6b2fa5]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6b2fa5]"></div>
            </label>
          </div>

          {enabledCollaboration && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex-1">
                <label className="text-sm font-semibold text-slate-900 block mb-1">
                  Allow Agents
                </label>
                <p className="text-xs text-slate-600">
                  Enable agents to sell tickets for this event
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAgents}
                  onChange={(e) => setAllowAgents(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#6b2fa5]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6b2fa5]"></div>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}