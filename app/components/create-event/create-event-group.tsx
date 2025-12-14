"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { setDoc, doc, collection, addDoc, getDoc } from "firebase/firestore"
import { Preloader } from "@/components/preloader"
import Image from "next/image"
import { AlertCircle } from "lucide-react"
import { AddPricing } from "./add-pricing"
import type { TicketType } from "@/types/ticket"

interface CreateEventGroupProps {
  onSuccess?: () => void
  selectedCollection?: any | null
}

export function CreateEventGroup({ onSuccess, selectedCollection }: CreateEventGroupProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [eventName, setEventName] = useState("")
  const [eventDescription, setEventDescription] = useState("")
  const [eventImage, setEventImage] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState("")
  const [frequency, setFrequency] = useState<"yearly" | "monthly" | "quarterly">("yearly")
  const [eventDate, setEventDate] = useState("")
  const [eventVenue, setEventVenue] = useState("")
  const [eventStart, setEventStart] = useState("")
  const [eventEnd, setEventEnd] = useState("")
  const [eventEndDate, setEventEndDate] = useState("")
  const [eventType, setEventType] = useState("Night party")
  const [enablePricing, setEnablePricing] = useState(false)
  const [ticketPrices, setTicketPrices] = useState<TicketType[]>([])

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
    if (selectedCollection) {
      if (!eventName.trim()) return "Event name is required"
      if (!eventDescription.trim()) return "Event description is required"
      if (!eventDate) return "Event date is required"
      if (!eventVenue.trim()) return "Event venue is required"
      if (!eventStart) return "Event start time is required"
      if (!eventEnd) return "Event end time is required"
      if (!eventEndDate) return "Event end date is required"
    } else {
      if (!eventName.trim()) return "Event group name is required"
      if (!eventDescription.trim()) return "Event description is required"
      if (!imagePreviewUrl) return "Event image is required"
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

      if (selectedCollection) {
        const { eventId, payId } = generateUniqueId()
        const userDoc = await getDoc(doc(db, "users", user.uid))
        const userData = userDoc.exists() ? userDoc.data() : {}
        const bookerName = userData.username || userData.fullName || "Unknown Booker"

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
          eventImage: imagePreviewUrl,
          ticketPrices: finalTicketPrices,
          isFree: !enablePricing,
          payId,
          eventId,
          createdBy: user.uid,
          bookerName,
          createdAt: new Date(),
          ticketsSold: 0,
          totalRevenue: 0,
          status: "active",
          collectionId: selectedCollection.id,
        }

        const nestedEventsRef = collection(
          db,
          "EventCollection",
          user.uid,
          "collections",
          selectedCollection.id,
          "events",
        )
        const docRef = await addDoc(nestedEventsRef, eventData)

        await setDoc(
          doc(db, "EventCollection", user.uid, "collections", selectedCollection.id, "events", docRef.id),
          {
            eventId,
            id: docRef.id,
          },
          { merge: true },
        )

        const publicEventData = {
          imageURL: imagePreviewUrl,
          eventType,
          venue: eventVenue,
          eventStartDate: eventDate,
          eventName,
          freeOrPaid: enablePricing && finalTicketPrices.some((t) => t.price > 0),
          timestamp: new Date(),
          creatorID: user.uid,
          eventId,
          eventGroup: true,
          collectionId: selectedCollection.id,
          collectionName: selectedCollection.name,
        }

        await setDoc(doc(db, "publicEvents", eventName), publicEventData)

        router.push(
          `/create-event/success?eventId=${eventId}&payId=${payId}&collectionName=${encodeURIComponent(selectedCollection.name)}`,
        )
      } else {
        const eventCollectionRef = doc(db, "EventCollection", user.uid, "collections", eventName)
        await setDoc(eventCollectionRef, {
          name: eventName,
          image: imagePreviewUrl,
          description: eventDescription,
          frequency,
          createdAt: new Date(),
          createdBy: user.uid,
        })

        const publicEventCollectionRef = doc(db, "publicEvents", eventName)
        await setDoc(publicEventCollectionRef, {
          eventName,
          imageURL: imagePreviewUrl,
          eventGroup: true,
          frequency,
          createdAt: new Date(),
          timestamp: new Date(),
          creatorID: user.uid,
        })

        router.push(`/create-event/success?type=event-group&eventName=${encodeURIComponent(eventName)}`)
      }
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

        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <h2 className="text-2xl font-bold text-foreground">
            {selectedCollection ? `Add Event to ${selectedCollection.name}` : "Event Group Information"}
          </h2>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {selectedCollection ? "Event Name" : "Event Group Name"} *
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder={
                selectedCollection
                  ? "e.g., Summer Tech Conference 2024"
                  : "e.g., Annual Tech Conference, Monthly Meetup"
              }
              className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Description *</label>
            <textarea
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder={
                selectedCollection ? "Describe this specific event instance" : "Describe your recurring event series"
              }
              rows={4}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
            />
          </div>

          {selectedCollection && (
            <>
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

              <div className="rounded-lg border border-border bg-card p-6">
                <AddPricing
                  enablePricing={enablePricing}
                  setEnablePricing={setEnablePricing}
                  ticketPrices={ticketPrices}
                  setTicketPrices={setTicketPrices}
                />
              </div>
            </>
          )}

          {!selectedCollection && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Recurrence Frequency *</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as "yearly" | "monthly" | "quarterly")}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
              >
                <option value="yearly">Yearly</option>
                <option value="quarterly">Quarterly (4 times/year)</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          )}
        </div>

        {!selectedCollection && (
          <div className="space-y-6 rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-bold text-foreground">Event Group Image</h2>

            <div className="space-y-4">
              {imagePreviewUrl && (
                <div className="relative w-full h-64">
                  <Image
                    src={imagePreviewUrl || "/placeholder.svg"}
                    alt="Event group preview"
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
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-[#6b2fa5] text-white font-semibold rounded-lg hover:bg-[#5a26a3] disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating..." : selectedCollection ? "Add Event to Collection" : "Create Event Group"}
          </button>
        </div>
      </form>
    </>
  )
}
