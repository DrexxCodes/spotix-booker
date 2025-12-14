"use client"

import { Camera } from 'lucide-react'

interface TicketFormProps {
  ticketId: string
  onTicketIdChange: (value: string) => void
  onVerify: () => void
  onScan: () => void
  loading: boolean
  selectedEventId: string | null
  errorMessage: string
}

export default function TicketForm({
  ticketId,
  onTicketIdChange,
  onVerify,
  onScan,
  loading,
  selectedEventId,
  errorMessage,
}: TicketFormProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <label htmlFor="ticket-id" className="block text-sm font-semibold text-gray-900">
        Enter Ticket ID
      </label>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            id="ticket-id"
            value={ticketId}
            onChange={(e) => onTicketIdChange(e.target.value)}
            placeholder="e.g., SPTX-TX-12A34B567"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] bg-white text-gray-900 placeholder:text-gray-400 transition-all duration-200 hover:border-gray-400"
            required
          />
        </div>
        <button
          onClick={onScan}
          disabled={!selectedEventId}
          className="px-5 py-3 bg-[#6b2fa5]/10 hover:bg-[#6b2fa5]/20 text-[#6b2fa5] rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 group hover:scale-105 active:scale-95 font-medium"
          title={!selectedEventId ? "Please select an event first" : "Scan QR Code"}
        >
          <Camera size={20} className="group-hover:rotate-12 transition-transform duration-200" />
          <span className="hidden sm:inline">Scan</span>
        </button>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 animate-in slide-in-from-top-2 duration-200">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 font-medium">{errorMessage}</p>
        </div>
      )}

      <button
        onClick={onVerify}
        disabled={!ticketId.trim() || !selectedEventId || loading}
        className="w-full px-6 py-4 bg-gradient-to-r from-[#6b2fa5] to-[#8b3fc5] hover:from-[#5a2789] hover:to-[#6b2fa5] text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-[#6b2fa5] disabled:hover:to-[#8b3fc5] shadow-lg shadow-[#6b2fa5]/25 hover:shadow-xl hover:shadow-[#6b2fa5]/40 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Verifying...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Verify Ticket</span>
          </>
        )}
      </button>
    </div>
  )
}