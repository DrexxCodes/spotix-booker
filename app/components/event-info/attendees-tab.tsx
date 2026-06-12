"use client"

import { useState, useMemo } from "react"
import {
  User, Mail, ShoppingCart, CheckCircle2, XCircle, ChevronUp,
  Search, Filter, Download, X, Ticket, Clock, Hash,
} from "lucide-react"
import RegistryDialog from "./helper/registry-dialog"

interface AttendeeData {
  id: string
  fullName: string
  email: string
  ticketType: string
  verified: boolean
  purchaseDate: string
  purchaseTime: string
  ticketReference: string
  facialEnroll: "enrolled" | "unenrolled"
  faceEmbedding?: number[] | null
}

interface AttendeesTabProps {
  attendees: AttendeeData[]
  formatFirestoreTimestamp: (timestamp: any) => string
  eventId: string
  eventName: string
}

// ── Attendee Summary Dialog ───────────────────────────────────────────────────
function AttendeeDialog({
  attendee,
  allAttendees,
  formatFirestoreTimestamp,
  onClose,
}: {
  attendee: AttendeeData
  allAttendees: AttendeeData[]
  formatFirestoreTimestamp: (ts: any) => string
  onClose: () => void
}) {
  const emailTickets = useMemo(
    () => allAttendees.filter((a) => a.email.toLowerCase() === attendee.email.toLowerCase()),
    [allAttendees, attendee.email]
  )

  const checkedInCount = emailTickets.filter((a) => a.verified).length
  const initials = attendee.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold truncate">{attendee.fullName}</h3>
              <p className="text-purple-200 text-sm truncate">{attendee.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-lg px-3 py-1.5 text-sm font-semibold">
              <Ticket size={14} />
              {emailTickets.length} ticket{emailTickets.length !== 1 ? "s" : ""} purchased
            </div>
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
              checkedInCount > 0 ? "bg-green-500/30 text-green-100" : "bg-white/10 text-white/70"
            }`}>
              <CheckCircle2 size={14} />
              {checkedInCount} checked in
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3 max-h-72 overflow-y-auto">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket breakdown</p>
          {emailTickets.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${
                t.verified ? "border-green-200 bg-green-50" : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                t.verified ? "bg-green-200 text-green-700" : "bg-slate-200 text-slate-600"
              }`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">{t.ticketType}</span>
                  {t.verified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5 flex-shrink-0">
                      <CheckCircle2 size={10} /> Checked In
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 flex-shrink-0">
                      <XCircle size={10} /> Not Checked In
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Hash size={10} />{t.ticketReference}</span>
                  <span className="flex items-center gap-1"><Clock size={10} />{formatFirestoreTimestamp(t.purchaseDate)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AttendeesTab({
  attendees,
  formatFirestoreTimestamp,
  eventId,
  eventName,
}: AttendeesTabProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [checkInFilter, setCheckInFilter] = useState<"all" | "checkedIn" | "notCheckedIn">("all")
  const [selectedAttendee, setSelectedAttendee] = useState<AttendeeData | null>(null)
  const [registryDialogOpen, setRegistryDialogOpen] = useState(false)

  const filteredAttendees = useMemo(() => {
    return attendees.filter((attendee) => {
      const matchesSearch =
        attendee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        attendee.fullName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesFilter =
        checkInFilter === "all" ||
        (checkInFilter === "checkedIn" && attendee.verified) ||
        (checkInFilter === "notCheckedIn" && !attendee.verified)
      return matchesSearch && matchesFilter
    })
  }, [attendees, searchTerm, checkInFilter])

  /**
   * JSON export includes eventId + eventName so the scanner can store them
   * against the imported guest list. The sync key is NOT included here —
   * it lives only in Booker's Firebase and is shown once to the user.
   */
  const handleExport = (format: "json" | "csv") => {
    const exportData = attendees.map((a) => ({
      fullName: a.fullName,
      email: a.email,
      ticketId: a.id,
      ticketType: a.ticketType,
      facialEnroll: a.facialEnroll,
      ...(a.faceEmbedding ? { faceEmbedding: a.faceEmbedding } : {}),
    }))

    const fileName = `spotix_${eventId}`

    if (format === "json") {
      // Wrap in envelope with event metadata
      const envelope = {
        eventId,
        eventName,
        guests: exportData,
      }
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" })
      triggerDownload(blob, `${fileName}.json`)
    } else {
      const headers = ["fullName", "email", "ticketId", "ticketType", "facialEnroll", "faceEmbedding"]
      const rows = exportData.map((row) =>
        headers.map((h) => {
          const value = row[h as keyof typeof row]
          if (Array.isArray(value)) return `"${(value as number[]).join("|")}"`
          return `"${String(value ?? "").replace(/"/g, '""')}"`
        }).join(",")
      )
      const csv = [headers.join(","), ...rows].join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      triggerDownload(blob, `${fileName}.csv`)
    }
  }

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const checkedInCount = attendees.filter((a) => a.verified).length
  const notCheckedInCount = attendees.filter((a) => !a.verified).length

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200 placeholder:text-slate-400"
          />
        </div>
        <div className="relative md:w-64">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <select
            value={checkInFilter}
            onChange={(e) => setCheckInFilter(e.target.value as any)}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200 appearance-none cursor-pointer"
          >
            <option value="all">All Attendees</option>
            <option value="checkedIn">Checked In</option>
            <option value="notCheckedIn">Not Checked In</option>
          </select>
          <ChevronUp className="absolute right-4 top-1/2 -translate-y-1/2 rotate-180 text-slate-400 pointer-events-none" size={20} />
        </div>
        <button
          onClick={() => setRegistryDialogOpen(true)}
          disabled={attendees.length === 0}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[#6b2fa5] text-white font-semibold text-sm rounded-xl shadow-lg shadow-[#6b2fa5]/25 hover:bg-[#5a2690] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap"
        >
          <Download size={18} />
          Download
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-xl p-5 text-white shadow-lg shadow-[#6b2fa5]/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-100">Total Attendees</p>
              <p className="text-3xl font-bold mt-1">{attendees.length}</p>
            </div>
            <User size={32} className="text-purple-200" />
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Checked In</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{checkedInCount}</p>
            </div>
            <CheckCircle2 size={32} className="text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Not Checked In</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{notCheckedInCount}</p>
            </div>
            <XCircle size={32} className="text-amber-500" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Reference</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Ticket Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Purchase Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Facial Enroll</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Check-In</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAttendees.length > 0 ? (
                filteredAttendees.map((attendee, index) => {
                  const emailCount = attendees.filter(
                    (a) => a.email.toLowerCase() === attendee.email.toLowerCase()
                  ).length
                  return (
                    <tr
                      key={attendee.id}
                      onClick={() => setSelectedAttendee(attendee)}
                      className="cursor-pointer hover:bg-[#6b2fa5]/5 transition-all duration-150 border-l-4 border-l-transparent hover:border-l-[#6b2fa5]"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-900">{attendee.ticketReference}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] flex items-center justify-center text-white font-semibold text-sm shadow-md">
                              {attendee.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            {emailCount > 1 && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center border border-white">
                                {emailCount}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-slate-900">{attendee.fullName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">{attendee.email}</span>
                          {emailCount > 1 && (
                            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 font-semibold flex-shrink-0">
                              ×{emailCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-[#6b2fa5]/10 to-[#8b4fc5]/10 text-[#6b2fa5] rounded-lg text-xs font-semibold border border-[#6b2fa5]/20">
                          {attendee.ticketType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600 font-medium">
                          {formatFirestoreTimestamp(attendee.purchaseDate)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          attendee.facialEnroll === "enrolled"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-50 text-slate-700 border border-slate-200"
                        }`}>
                          {attendee.facialEnroll === "enrolled" ? "✓ Enrolled" : "○ Unenrolled"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          attendee.verified
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-slate-50 text-slate-500 border border-slate-200"
                        }`}>
                          {attendee.verified
                            ? <><CheckCircle2 size={12} /> Checked In</>
                            : <><XCircle size={12} /> Not Checked In</>
                          }
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                        <User size={32} className="text-slate-400" />
                      </div>
                      <p className="text-slate-600 font-medium">
                        {searchTerm || checkInFilter !== "all" ? "No attendees match your search" : "No attendees yet"}
                      </p>
                      {(searchTerm || checkInFilter !== "all") && (
                        <button
                          onClick={() => { setSearchTerm(""); setCheckInFilter("all") }}
                          className="text-sm text-[#6b2fa5] font-semibold hover:underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registry Export Dialog */}
      <RegistryDialog
        open={registryDialogOpen}
        onClose={() => setRegistryDialogOpen(false)}
        onExport={handleExport}
        attendeeCount={attendees.length}
        eventId={eventId}
        eventName={eventName}
      />

      {/* Attendee summary dialog */}
      {selectedAttendee && (
        <AttendeeDialog
          attendee={selectedAttendee}
          allAttendees={attendees}
          formatFirestoreTimestamp={formatFirestoreTimestamp}
          onClose={() => setSelectedAttendee(null)}
        />
      )}
    </div>
  )
}
