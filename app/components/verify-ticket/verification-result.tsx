"use client"

import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface TicketData {
  id: string
  eventId: string
  eventName: string
  attendeeName: string
  attendeeEmail: string
  ticketType: string
  purchaseDate: string
  purchaseTime: string
  isVerified: boolean
  ticketReference: string
}

interface VerificationResultProps {
  status: "success" | "error" | "already-verified" | "not-found"
  ticketData: TicketData | null
  errorMessage: string
  onScanAgain: () => void
}

export default function VerificationResult({
  status,
  ticketData,
  errorMessage,
  onScanAgain,
}: VerificationResultProps) {
  const isSuccess = status === "success"
  const isAlreadyVerified = status === "already-verified"
  const isError = status === "error" || status === "not-found"

  return (
    <div
      className={`rounded-2xl border-2 p-8 space-y-6 shadow-xl animate-in zoom-in-95 duration-300 ${
        isSuccess
          ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300"
          : isAlreadyVerified
            ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300"
            : "bg-gradient-to-br from-red-50 to-rose-50 border-red-300"
      }`}
    >
      {/* Icon */}
      <div className="flex justify-center">
        {isSuccess ? (
          <div className="p-5 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full shadow-lg animate-in zoom-in duration-500">
            <CheckCircle size={48} className="text-green-600" strokeWidth={2.5} />
          </div>
        ) : isAlreadyVerified ? (
          <div className="p-5 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full shadow-lg animate-in zoom-in duration-500">
            <AlertTriangle size={48} className="text-amber-600" strokeWidth={2.5} />
          </div>
        ) : (
          <div className="p-5 bg-gradient-to-br from-red-100 to-rose-100 rounded-full shadow-lg animate-in zoom-in duration-500">
            <XCircle size={48} className="text-red-600" strokeWidth={2.5} />
          </div>
        )}
      </div>

      {/* Title */}
      <div className="text-center space-y-2">
        <h2
          className={`text-3xl font-bold ${
            isSuccess ? "text-green-700" : isAlreadyVerified ? "text-amber-700" : "text-red-700"
          }`}
        >
          {isSuccess
            ? "Ticket Verified Successfully!"
            : isAlreadyVerified
              ? "Ticket Already Verified"
              : "Verification Failed"}
        </h2>
        <p className={`text-sm ${
          isSuccess ? "text-green-600" : isAlreadyVerified ? "text-amber-600" : "text-red-600"
        }`}>
          {isSuccess
            ? "This ticket is valid and has been marked as verified"
            : isAlreadyVerified
              ? "This ticket was previously scanned and verified"
              : "Unable to verify this ticket"}
        </p>
      </div>

      {/* Ticket Details */}
      {ticketData && (
        <div className="space-y-1 bg-white rounded-xl p-5 shadow-md border border-gray-100">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 pb-2 border-b border-gray-200">
            Ticket Information
          </h3>
          <DetailRow label="Ticket ID" value={ticketData.id} highlight />
          <DetailRow label="Reference" value={ticketData.ticketReference} />
          <DetailRow label="Event" value={ticketData.eventName} highlight />
          <DetailRow label="Attendee" value={ticketData.attendeeName} />
          <DetailRow label="Email" value={ticketData.attendeeEmail} />
          <DetailRow label="Ticket Type" value={ticketData.ticketType} />
          <DetailRow label="Purchase Date" value={ticketData.purchaseDate} />
          <DetailRow label="Purchase Time" value={ticketData.purchaseTime} />
        </div>
      )}

      {/* Error Message */}
      {isError && (
        <div className="bg-white border-2 border-red-300 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 font-medium leading-relaxed">
            {errorMessage || "An error occurred during verification."}
          </p>
        </div>
      )}

      {/* Warning Message */}
      {isAlreadyVerified && (
        <div className="bg-white border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-amber-700 font-medium leading-relaxed">
            This ticket has already been verified. Please check with the attendee or event manager.
          </p>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={onScanAgain}
        className="w-full px-6 py-4 bg-gradient-to-r from-[#6b2fa5] to-[#8b3fc5] hover:from-[#5a2789] hover:to-[#6b2fa5] text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-[#6b2fa5]/30 hover:shadow-xl hover:shadow-[#6b2fa5]/40 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>{isSuccess ? "Scan Another Ticket" : "Try Again"}</span>
      </button>
    </div>
  )
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0 group hover:bg-gray-50 px-2 -mx-2 rounded-lg transition-colors duration-150">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className={`text-sm font-semibold text-right max-w-[60%] truncate ${
        highlight ? "text-[#6b2fa5]" : "text-gray-900"
      }`}>
        {value}
      </span>
    </div>
  )
}