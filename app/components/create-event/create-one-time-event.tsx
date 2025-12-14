"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { collection, addDoc, setDoc, doc, getDoc } from "firebase/firestore"
import { Preloader } from "@/components/preloader"
import { AddPricing } from "./add-pricing"
import Image from "next/image"
import { AlertCircle } from "lucide-react"

interface TicketType {
  policy: string
  price: string
  description: string
  availableTickets: string
}

interface CreateOneTimeEventProps {
  onSuccess?: () => void
}

export function CreateOneTimeEvent({ onSuccess }: CreateOneTimeEventProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Form states
  const [eventName, setEventName] = useState("")
  const [eventDescription, setEventDescription] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [eventVenue, setEventVenue] = useState("")
  const [eventStart, setEventStart] = useState("")
  const [eventEnd, setEventEnd] = useState("")
  const [eventEndDate, setEventEndDate] = useState("")
  const [eventType, setEventType] = useState("Night party")
  const [eventImage, setEventImage] = useState<File | null>(null)
  const [eventImageUrl, setEventImageUrl] = useState("")
  const [imagePreviewUrl, setImagePreviewUrl] = useState("")

  // Pricing states
  const [enablePricing, setEnablePricing] = useState(false)
  const [ticketPrices, setTicketPrices] = useState<TicketType[]>([])

  // Additional settings
  const [enableStopDate, setEnableStopDate] = useState(false)
  const [stopDate, setStopDate] = useState("")
  const [enableColorCode, setEnableColorCode] = useState(false)
  const [colorCode, setColorCode] = useState("#6b2fa5")
  const [enableMaxSize, setEnableMaxSize] = useState(false)
  const [maxSize, setMaxSize] = useState("")
  const [enabledCollaboration, setEnabledCollaboration] = useState(false)
  const [allowAgents, setAllowAgents] = useState(false)

  const eventTypes = [
    "Night party",
    "Concert",
    "Conference",
    "Workshop",
    "Seminar",
    "Wedding",
    "Birthday",
    "Corporate Event",
    "Sports Event",
    "Festival",
  ]

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    setEventImage(file)
    const previewUrl = URL.createObjectURL(file)
    setImagePreviewUrl(previewUrl)
  }

  const validateForm = () => {
    if (!eventName.trim()) return "Event name is required"
    if (!eventDescription.trim()) return "Event description is required"
    if (!eventDate) return "Event date is required"
    if (!eventVenue.trim()) return "Event venue is required"
    if (!eventStart) return "Event start time is required"
    if (!eventEnd) return "Event end time is required"
    if (!eventEndDate) return "Event end date is required"
    if (!eventImageUrl && !imagePreviewUrl) return "Event image is required"

    const startDateTime = new Date(`${eventDate}T${eventStart}`)
    const endDateTime = new Date(`${eventEndDate}T${eventEnd}`)
    if (endDateTime <= startDateTime) return "Event end time must be after start time"

    if (enableStopDate && stopDate) {
      const stopDateTime = new Date(stopDate)
      if (stopDateTime >= startDateTime) return "Stop date must be before event start date"
    }

    return null
  }

  const generateUniqueId = () => {
    const timestamp = Date.now().toString(36)
    const randomStr = Math.random().toString(36).substring(2, 8)
    return {
      eventId: `evt_${timestamp}_${randomStr}`.toUpperCase(),
      payId: `pay_${timestamp}_${randomStr}`.toUpperCase(),
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const validationError = validateForm()
      if (validationError) {
        setError(validationError)
        return
      }

      const user = auth.currentUser
      if (!user) throw new Error("User not authenticated")

      // Get user data
      const userDoc = await getDoc(doc(db, "users", user.uid))
      const userData = userDoc.exists() ? userDoc.data() : {}
      const bookerName = userData.username || userData.fullName || "Unknown Booker"

      const { eventId, payId } = generateUniqueId()

      // Process ticket prices
      const finalTicketPrices = enablePricing
        ? ticketPrices
            .filter((t) => t.policy.trim())
            .map((ticket) => ({
              policy: ticket.policy,
              price: ticket.price === "" ? 0 : Number.parseFloat(ticket.price),
              description: ticket.description,
              availableTickets: ticket.availableTickets === "" ? null : Number.parseInt(ticket.availableTickets),
            }))
        : []

      const eventData = {
        eventName,
        eventDescription,
        eventDate,
        eventEndDate,
        eventVenue,
        eventStart,
        eventEnd,
        eventType,
        eventImage: eventImageUrl || imagePreviewUrl,
        ticketPrices: finalTicketPrices,
        enableStopDate,
        stopDate: enableStopDate ? stopDate : null,
        enableColorCode,
        colorCode: enableColorCode ? colorCode : null,
        enableMaxSize,
        maxSize: enableMaxSize ? maxSize : null,
        isFree: !enablePricing,
        payId,
        eventId,
        createdBy: user.uid,
        bookerName,
        createdAt: new Date(),
        ticketsSold: 0,
        totalRevenue: 0,
        status: "active",
        enabledCollaboration,
        allowAgents,
      }

      // Create in user's events collection
      const eventsCollectionRef = collection(db, "events", user.uid, "userEvents")
      const docRef = await addDoc(eventsCollectionRef, eventData)

      // Update with IDs
      await setDoc(
        doc(db, "events", user.uid, "userEvents", docRef.id),
        {
          eventId,
          id: docRef.id,
        },
        { merge: true },
      )

      // Create public event entry
      const publicEventData = {
        imageURL: eventImageUrl || imagePreviewUrl,
        eventType,
        venue: eventVenue,
        eventStartDate: eventDate,
        eventName,
        freeOrPaid: enablePricing && finalTicketPrices.some((t) => t.price > 0),
        timestamp: new Date(),
        creatorID: user.uid,
        eventId,
        eventGroup: false,
      }

      await setDoc(doc(db, "publicEvents", eventName), publicEventData)

      // Redirect to success page
      router.push(`/create-event/success?eventId=${eventId}&payId=${payId}`)
    } catch (err: any) {
      setError(err.message || "Failed to create event")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Preloader isLoading={loading} />

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="flex gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <h2 className="text-2xl font-bold text-foreground">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Event Name *</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Enter event name"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Description *</label>
            <textarea
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="Enter event description"
              rows={4}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Event Type *</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
              >
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Venue *</label>
              <input
                type="text"
                value={eventVenue}
                onChange={(e) => setEventVenue(e.target.value)}
                placeholder="Enter venue name or address"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
              />
            </div>
          </div>
        </div>

        {/* Date and Time */}
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <h2 className="text-2xl font-bold text-foreground">Date & Time</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Start Date *</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Start Time *</label>
              <input
                type="time"
                value={eventStart}
                onChange={(e) => setEventStart(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">End Date *</label>
              <input
                type="date"
                value={eventEndDate}
                onChange={(e) => setEventEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">End Time *</label>
              <input
                type="time"
                value={eventEnd}
                onChange={(e) => setEventEnd(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
              />
            </div>
          </div>
        </div>

        {/* Event Image */}
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <h2 className="text-2xl font-bold text-foreground">Event Image</h2>

          <div className="space-y-4">
            {imagePreviewUrl && (
              <div className="relative w-full h-64">
                <Image
                  src={imagePreviewUrl || "/placeholder.svg"}
                  alt="Event preview"
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background"
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="rounded-lg border border-border bg-card p-6">
          <AddPricing
            enablePricing={enablePricing}
            setEnablePricing={setEnablePricing}
            ticketPrices={ticketPrices}
            setTicketPrices={setTicketPrices}
          />
        </div>

        {/* Additional Settings */}
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <h2 className="text-2xl font-bold text-foreground">Additional Settings</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Enable Stop Date for Ticket Sales</label>
              <input
                type="checkbox"
                checked={enableStopDate}
                onChange={(e) => setEnableStopDate(e.target.checked)}
                className="h-4 w-4 accent-[#6b2fa5]"
              />
            </div>
            {enableStopDate && (
              <input
                type="datetime-local"
                value={stopDate}
                onChange={(e) => setStopDate(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
              />
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Enable Color Theme</label>
              <input
                type="checkbox"
                checked={enableColorCode}
                onChange={(e) => setEnableColorCode(e.target.checked)}
                className="h-4 w-4 accent-[#6b2fa5]"
              />
            </div>
            {enableColorCode && (
              <input
                type="color"
                value={colorCode}
                onChange={(e) => setColorCode(e.target.value)}
                className="h-12 w-full rounded-lg border border-border"
              />
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Set Maximum Attendees</label>
              <input
                type="checkbox"
                checked={enableMaxSize}
                onChange={(e) => setEnableMaxSize(e.target.checked)}
                className="h-4 w-4 accent-[#6b2fa5]"
              />
            </div>
            {enableMaxSize && (
              <input
                type="number"
                value={maxSize}
                onChange={(e) => setMaxSize(e.target.value)}
                placeholder="Maximum number of attendees"
                min="1"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
              />
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Enable Collaboration</label>
              <input
                type="checkbox"
                checked={enabledCollaboration}
                onChange={(e) => setEnabledCollaboration(e.target.checked)}
                className="h-4 w-4 accent-[#6b2fa5]"
              />
            </div>

            {enabledCollaboration && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Allow Agents</label>
                <input
                  type="checkbox"
                  checked={allowAgents}
                  onChange={(e) => setAllowAgents(e.target.checked)}
                  className="h-4 w-4 accent-[#6b2fa5]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-[#6b2fa5] text-white font-semibold rounded-lg hover:bg-[#5a26a3] disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating Event..." : "Create Event"}
          </button>
        </div>
      </form>
    </>
  )
}
