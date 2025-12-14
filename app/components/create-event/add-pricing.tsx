"use client"

import { useState, useEffect } from "react"
import { Plus, X, AlertCircle } from "lucide-react"

interface TicketType {
  policy: string
  price: string
  description: string
  availableTickets: string
}

interface AddPricingProps {
  enablePricing: boolean
  setEnablePricing: (enabled: boolean) => void
  ticketPrices: TicketType[]
  setTicketPrices: (tickets: TicketType[]) => void
}

export function AddPricing({ enablePricing, setEnablePricing, ticketPrices, setTicketPrices }: AddPricingProps) {
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (enablePricing && ticketPrices.length === 0) {
      setTicketPrices([{ policy: "", price: "", description: "", availableTickets: "" }])
    }
  }, [enablePricing, ticketPrices.length, setTicketPrices])

  useEffect(() => {
    if (!enablePricing) {
      setErrorMessage("")
    }
  }, [enablePricing])

  const handlePricingToggle = () => {
    const newEnablePricing = !enablePricing
    setEnablePricing(newEnablePricing)

    if (!newEnablePricing) {
      setTicketPrices([])
      setErrorMessage("")
    } else {
      setTicketPrices([{ policy: "", price: "", description: "", availableTickets: "" }])
    }
  }

  const validateFreeTickets = (tickets: TicketType[]) => {
    const freeTickets = tickets.filter(
      (ticket) =>
        ticket.policy.trim() && (ticket.price === "" || ticket.price === "0" || Number.parseFloat(ticket.price) === 0),
    )

    if (freeTickets.length > 1) {
      setErrorMessage("Only one ticket type can be set as free when pricing is enabled.")
      return false
    } else {
      setErrorMessage("")
      return true
    }
  }

  const updateTicket = (index: number, field: keyof TicketType, value: string) => {
    const newTickets = [...ticketPrices]
    newTickets[index][field] = value
    setTicketPrices(newTickets)

    if (field === "price" || field === "policy") {
      validateFreeTickets(newTickets)
    }
  }

  const addTicketType = () => {
    const newTickets = [...ticketPrices, { policy: "", price: "", description: "", availableTickets: "" }]
    setTicketPrices(newTickets)
  }

  const removeTicketType = (index: number) => {
    if (ticketPrices.length > 1) {
      const newTickets = ticketPrices.filter((_, i) => i !== index)
      setTicketPrices(newTickets)
      validateFreeTickets(newTickets)
    }
  }

  const isTicketFree = (price: string) => {
    return price === "" || price === "0" || Number.parseFloat(price) === 0
  }

  const formatNumber = (num: string) => {
    const number = Number.parseInt(num)
    return isNaN(number) ? 0 : number.toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-foreground">Event Pricing</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enablePricing}
            onChange={handlePricingToggle}
            className="h-4 w-4 accent-[#6b2fa5]"
          />
          <span className="text-sm font-medium text-foreground">Enable Pricing</span>
        </label>
      </div>

      {!enablePricing && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-semibold text-green-800 mb-1">FREE EVENT</p>
          <p className="text-sm text-green-700">
            Your event is set as free. Attendees can get tickets without payment.
          </p>
        </div>
      )}

      {enablePricing && (
        <div className="space-y-6">
          {errorMessage && (
            <div className="flex gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{errorMessage}</p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Configure your ticket types and prices. You can have multiple ticket types, but only <strong>one</strong>{" "}
            can be set as free.
          </p>

          <div className="space-y-4">
            {ticketPrices.map((ticket, index) => (
              <div key={index} className="rounded-lg border border-border bg-background p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground">Ticket Type {index + 1}</h4>
                  {ticketPrices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTicketType(index)}
                      className="p-1 hover:bg-red-50 rounded transition-colors"
                    >
                      <X size={18} className="text-red-600" />
                    </button>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Ticket Name *</label>
                    <input
                      type="text"
                      placeholder="e.g., VIP, General Admission"
                      value={ticket.policy}
                      onChange={(e) => updateTicket(index, "policy", e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2 flex items-center justify-between">
                      Price (₦) *
                      {isTicketFree(ticket.price) && ticket.policy.trim() && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">FREE</span>
                      )}
                    </label>
                    <input
                      type="number"
                      placeholder="0 for free ticket"
                      value={ticket.price}
                      onChange={(e) => updateTicket(index, "price", e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Available Tickets</label>
                  <input
                    type="number"
                    placeholder="Leave empty for unlimited"
                    value={ticket.availableTickets}
                    onChange={(e) => updateTicket(index, "availableTickets", e.target.value)}
                    min="1"
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
                  />
                  {ticket.availableTickets && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatNumber(ticket.availableTickets)} tickets available
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                  <textarea
                    placeholder="What does this ticket include?"
                    value={ticket.description}
                    onChange={(e) => updateTicket(index, "description", e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addTicketType}
            disabled={!!errorMessage}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-background disabled:opacity-50 transition-colors"
          >
            <Plus size={18} />
            Add Another Ticket Type
          </button>

          {ticketPrices.filter((t) => t.policy.trim()).length > 0 && (
            <div className="rounded-lg border border-[#6b2fa5]/20 bg-[#6b2fa5]/5 p-4">
              <h4 className="font-semibold text-foreground mb-3">Pricing Summary</h4>
              <div className="space-y-2">
                {ticketPrices
                  .filter((t) => t.policy.trim())
                  .map((ticket, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{ticket.policy}</span>
                      <span className="font-semibold text-[#6b2fa5]">
                        {isTicketFree(ticket.price)
                          ? "FREE"
                          : `₦${Number.parseFloat(ticket.price || "0").toLocaleString()}`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
