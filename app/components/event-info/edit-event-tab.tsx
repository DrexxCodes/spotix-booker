"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Plus, X, AlertCircle, Calendar, MapPin, Clock, Tag, Ticket, DollarSign, Users, FileText } from "lucide-react"

interface TicketType {
  policy: string
  price: string
  description?: string
  availableTickets?: string
}

interface EditEventTabProps {
  editFormData: any
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  handleTicketPriceChange: (index: number, field: string, value: string) => void
  addTicketPrice: () => void
  handleSubmitEdit: (e: React.FormEvent) => void
  setEditFormData: (data: any) => void
}

export default function EditEventTab({
  editFormData,
  handleInputChange,
  handleTicketPriceChange,
  addTicketPrice,
  handleSubmitEdit,
  setEditFormData,
}: EditEventTabProps) {
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (editFormData.enablePricing && editFormData.ticketPrices) {
      const freeTickets = editFormData.ticketPrices.filter(
        (t: TicketType) => t.policy.trim() && (t.price === "" || t.price === "0" || Number.parseFloat(t.price) === 0),
      )
      if (freeTickets.length > 1) {
        setErrorMessage("Only one ticket type can be free")
      } else {
        setErrorMessage("")
      }
    }
  }, [editFormData.ticketPrices, editFormData.enablePricing])

  const isTicketFree = (price: string) => price === "" || price === "0" || Number.parseFloat(price) === 0

  const removeTicketType = (index: number) => {
    if (editFormData.ticketPrices.length > 1) {
      const updated = editFormData.ticketPrices.filter((_: any, i: number) => i !== index)
      setEditFormData({ ...editFormData, ticketPrices: updated })
    }
  }

  return (
    <div className="space-y-6">
      {/* Event Bio-Data */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-lg">
            <FileText size={20} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Event Bio-Data</h3>
        </div>
        
        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Tag size={16} className="text-[#6b2fa5]" />
              Event Name
            </label>
            <input
              type="text"
              name="eventName"
              value={editFormData.eventName}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
              placeholder="Enter event name"
              required
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <FileText size={16} className="text-[#6b2fa5]" />
              Event Description
            </label>
            <textarea
              name="eventDescription"
              value={editFormData.eventDescription}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200 resize-none"
              placeholder="Describe your event..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Calendar size={16} className="text-[#6b2fa5]" />
                Event Date
              </label>
              <input
                type="datetime-local"
                name="eventDate"
                value={editFormData.eventDate}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <MapPin size={16} className="text-[#6b2fa5]" />
                Event Venue
              </label>
              <input
                type="text"
                name="eventVenue"
                value={editFormData.eventVenue}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
                placeholder="Enter venue location"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Clock size={16} className="text-[#6b2fa5]" />
                Start Time
              </label>
              <input
                type="time"
                name="eventStart"
                value={editFormData.eventStart}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Calendar size={16} className="text-[#6b2fa5]" />
                End Date
              </label>
              <input
                type="date"
                name="eventEndDate"
                value={editFormData.eventEndDate}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Clock size={16} className="text-[#6b2fa5]" />
                End Time
              </label>
              <input
                type="time"
                name="eventEnd"
                value={editFormData.eventEnd}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
                required
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Tag size={16} className="text-[#6b2fa5]" />
              Event Type
            </label>
            <select
              name="eventType"
              value={editFormData.eventType}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200 appearance-none cursor-pointer"
              required
            >
              <option value="Concert">Concert</option>
              <option value="Conference">Conference</option>
              <option value="Workshop">Workshop</option>
              <option value="Night party">Night party</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Event Pricing */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-lg">
            <DollarSign size={20} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Event Pricing</h3>
        </div>

        <div className="flex items-center gap-3 mb-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border-2 border-slate-200">
          <input
            type="checkbox"
            name="enablePricing"
            checked={editFormData.enablePricing}
            onChange={(e) => {
              setEditFormData({
                ...editFormData,
                enablePricing: e.target.checked,
                ticketPrices:
                  e.target.checked && editFormData.ticketPrices.length === 0
                    ? [{ policy: "", price: "", description: "", availableTickets: "" }]
                    : editFormData.ticketPrices,
              })
            }}
            className="w-5 h-5 rounded border-2 border-slate-300 text-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20 cursor-pointer"
          />
          <label className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
            Enable Paid Ticketing
          </label>
        </div>

        {!editFormData.enablePricing ? (
          <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Ticket size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-green-800">FREE EVENT</p>
                <p className="text-xs text-green-700">Attendees can get tickets without payment</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {errorMessage && (
              <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-xl">
                <div className="flex gap-3">
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">{errorMessage}</p>
                    <p className="text-xs text-red-700 mt-1">Please adjust your ticket pricing configuration</p>
                  </div>
                </div>
              </div>
            )}

            {editFormData.ticketPrices.map((ticket: TicketType, index: number) => (
              <div key={index} className="p-5 border-2 border-slate-200 rounded-xl bg-gradient-to-br from-white to-slate-50 hover:shadow-md transition-all duration-200">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-lg flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <h4 className="font-bold text-slate-900">Ticket Type {index + 1}</h4>
                  </div>
                  {editFormData.ticketPrices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTicketType(index)}
                      className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-all duration-200 hover:scale-110 active:scale-95"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <Ticket size={16} className="text-[#6b2fa5]" />
                      Ticket Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Early Bird, VIP, General Admission"
                      value={ticket.policy}
                      onChange={(e) => handleTicketPriceChange(index, "policy", e.target.value)}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <DollarSign size={16} className="text-[#6b2fa5]" />
                      Price (₦)
                      {isTicketFree(ticket.price) && ticket.policy.trim() && (
                        <span className="ml-2 px-2.5 py-1 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-lg text-xs font-bold border border-green-200">
                          FREE
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0 for free ticket"
                      value={ticket.price}
                      onChange={(e) => handleTicketPriceChange(index, "price", e.target.value)}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Users size={16} className="text-[#6b2fa5]" />
                    Available Tickets
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter number of tickets available"
                    value={ticket.availableTickets || ""}
                    onChange={(e) => handleTicketPriceChange(index, "availableTickets", e.target.value)}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
                    required
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <FileText size={16} className="text-[#6b2fa5]" />
                    Description
                  </label>
                  <textarea
                    placeholder="Describe what this ticket includes (perks, benefits, access levels, etc.)"
                    value={ticket.description || ""}
                    onChange={(e) => handleTicketPriceChange(index, "description", e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200 resize-none"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addTicketPrice}
              disabled={!!errorMessage}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-700 font-semibold hover:border-[#6b2fa5] hover:bg-[#6b2fa5]/5 hover:text-[#6b2fa5] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:bg-transparent disabled:hover:text-slate-700 transition-all duration-200"
            >
              <Plus size={20} />
              Add Another Ticket Type
            </button>
          </div>
        )}
      </div>

      {/* Submit Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={handleSubmitEdit}
          className="flex-1 px-6 py-4 bg-gradient-to-r from-[#6b2fa5] to-[#8b4fc5] text-white rounded-xl font-bold hover:shadow-lg hover:shadow-[#6b2fa5]/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          💾 Save Changes
        </button>
        <button
          type="button"
          className="flex-1 px-6 py-4 border-2 border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  )
}