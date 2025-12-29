"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { collection, addDoc, setDoc, doc, serverTimestamp } from "firebase/firestore"
import { Preloader } from "@/components/preloader"
import { AddPricing } from "./add-pricing"
import Image from "next/image"
import {
  AlertCircle,
  CheckCircle,
  MapPin,
  X,
  Upload,
  Calendar,
  Type,
  AlignLeft,
  MapPinned,
  ImageIcon,
  Settings,
  Sparkles,
} from "lucide-react"
import { uploadImage } from "@/lib/image-uploader"
import { MapPickerModal } from "./map-picker-modal"
import type { TicketType } from "@/types/ticket"

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
  const [eventImages, setEventImages] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [eventDate, setEventDate] = useState("")
  const [eventVenue, setEventVenue] = useState("")
  const [eventStart, setEventStart] = useState("")
  const [eventEnd, setEventEnd] = useState("")
  const [eventEndDate, setEventEndDate] = useState("")
  const [eventType, setEventType] = useState("Night party")
  const [enablePricing, setEnablePricing] = useState(false)
  const [ticketPrices, setTicketPrices] = useState<TicketType[]>([])
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [registrationClosed, setRegistrationClosed] = useState(false)
  const [enableStopDate, setEnableStopDate] = useState(false)
  const [stopDate, setStopDate] = useState("")
  const [enabledCollaboration, setEnabledCollaboration] = useState(false)
  const [allowAgents, setAllowAgents] = useState(false)

  // Upload states
  const [uploadProgress, setUploadProgress] = useState<number[]>([])
  const [isUploading, setIsUploading] = useState<boolean[]>([])
  const [uploadComplete, setUploadComplete] = useState<boolean[]>([])
  const [uploadedImageUrls, setUploadedImageUrls] = useState<(string | null)[]>([])
  const cancelUploadRefs = useRef<((() => void) | null)[]>([])

  const [venueCoordinates, setVenueCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    return () => {
      cancelUploadRefs.current.forEach((cancel) => {
        if (cancel) cancel()
      })
    }
  }, [])

  // Validation: Get minimum date (current date + 2 days)
  const getMinDate = () => {
    const today = new Date()
    const minDate = new Date(today)
    minDate.setDate(today.getDate() + 2)
    return minDate.toISOString().split("T")[0]
  }

  // Validation: Get max stop date (event start date - 3 days)
  const getMaxStopDate = () => {
    if (!eventDate) return ""
    const eventStartDate = new Date(eventDate)
    const maxStopDate = new Date(eventStartDate)
    maxStopDate.setDate(eventStartDate.getDate() - 3)
    return maxStopDate.toISOString().split("T")[0]
  }

  // Validation: Check if end date/time is valid
  const validateEndDateTime = () => {
    if (!eventDate || !eventStart || !eventEndDate || !eventEnd) return true

    const startDateTime = new Date(`${eventDate}T${eventStart}`)
    const endDateTime = new Date(`${eventEndDate}T${eventEnd}`)

    return endDateTime > startDateTime
  }

  // Validation: Check if stop date is valid
  const validateStopDate = () => {
    if (!enableStopDate || !stopDate || !eventDate) return true

    const eventStartDate = new Date(eventDate)
    const stopDateTime = new Date(stopDate)
    const maxStopDate = new Date(eventStartDate)
    maxStopDate.setDate(eventStartDate.getDate() - 3)

    // Stop date must be at least 3 days before event start
    return stopDateTime <= maxStopDate && stopDateTime < eventStartDate
  }

  // Auto-clear end date/time when start date/time changes
  useEffect(() => {
    if (!eventDate || !eventStart) {
      setEventEndDate("")
      setEventEnd("")
    }
  }, [eventDate, eventStart])

  // Auto-adjust stop date if it becomes invalid
  useEffect(() => {
    if (enableStopDate && stopDate && eventDate) {
      const eventStartDate = new Date(eventDate)
      const stopDateTime = new Date(stopDate)
      const maxStopDate = new Date(eventStartDate)
      maxStopDate.setDate(eventStartDate.getDate() - 3)

      if (stopDateTime > maxStopDate) {
        setStopDate("")
      }
    }
  }, [eventDate, stopDate, enableStopDate])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    handleFiles(Array.from(files))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"))
    if (files.length > 0) {
      handleFiles(files)
    }
  }

  const handleFiles = (files: File[]) => {
    const remainingSlots = 8 - eventImages.length
    if (remainingSlots <= 0) {
      alert("Maximum 8 images allowed")
      return
    }

    const filesToAdd = files.slice(0, remainingSlots)
    const newImages = [...eventImages, ...filesToAdd]
    const newPreviews = [...imagePreviewUrls, ...filesToAdd.map((file) => URL.createObjectURL(file))]

    setEventImages(newImages)
    setImagePreviewUrls(newPreviews)

    const startIndex = eventImages.length
    filesToAdd.forEach((file, index) => {
      startBackgroundUpload(file, startIndex + index)
    })
  }

  const startBackgroundUpload = (file: File, index: number) => {
    if (cancelUploadRefs.current[index]) {
      cancelUploadRefs.current[index]!()
      cancelUploadRefs.current[index] = null
    }

    setIsUploading((prev) => {
      const newState = [...prev]
      newState[index] = true
      return newState
    })
    setUploadProgress((prev) => {
      const newState = [...prev]
      newState[index] = 0
      return newState
    })

    const { uploadPromise, cancelUpload } = uploadImage(file, {
      cloudinaryFolder: "Events",
      onProgress: (progress) => {
        setUploadProgress((prev) => {
          const newState = [...prev]
          newState[index] = progress
          return newState
        })
      },
      showAlert: false,
    })

    cancelUploadRefs.current[index] = cancelUpload

    uploadPromise
      .then(({ url, provider }) => {
        setIsUploading((prev) => {
          const newState = [...prev]
          newState[index] = false
          return newState
        })

        if (url) {
          console.log(`[v0] Image ${index + 1} uploaded successfully to`, provider)
          setUploadComplete((prev) => {
            const newState = [...prev]
            newState[index] = true
            return newState
          })
          setUploadedImageUrls((prev) => {
            const newState = [...prev]
            newState[index] = url
            return newState
          })

          setTimeout(() => {
            setUploadComplete((prev) => {
              const newState = [...prev]
              newState[index] = false
              return newState
            })
          }, 5000)
        } else {
          console.error(`[v0] Upload failed for image ${index + 1}: No URL returned`)
        }
      })
      .catch((error) => {
        console.error(`[v0] Upload failed for image ${index + 1}:`, error)
        setIsUploading((prev) => {
          const newState = [...prev]
          newState[index] = false
          return newState
        })
      })
  }

  const removeImage = (index: number) => {
    if (cancelUploadRefs.current[index]) {
      cancelUploadRefs.current[index]!()
    }

    const newImages = eventImages.filter((_, i) => i !== index)
    const newPreviews = imagePreviewUrls.filter((_, i) => i !== index)
    const newUploadedUrls = uploadedImageUrls.filter((_, i) => i !== index)
    const newProgress = uploadProgress.filter((_, i) => i !== index)
    const newUploading = isUploading.filter((_, i) => i !== index)
    const newComplete = uploadComplete.filter((_, i) => i !== index)
    cancelUploadRefs.current = cancelUploadRefs.current.filter((_, i) => i !== index)

    setEventImages(newImages)
    setImagePreviewUrls(newPreviews)
    setUploadedImageUrls(newUploadedUrls)
    setUploadProgress(newProgress)
    setIsUploading(newUploading)
    setUploadComplete(newComplete)

    URL.revokeObjectURL(imagePreviewUrls[index])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    console.log("[v0] Form submitted - starting validation")

    if (!auth.currentUser) {
      setError("You must be logged in to create an event")
      console.log("[v0] No authenticated user")
      return
    }

    if (!eventName || !eventDate || !eventVenue || !eventStart || !eventEndDate || !eventEnd) {
      setError("Please fill in all required fields")
      console.log("[v0] Missing required fields", {
        eventName,
        eventDate,
        eventVenue,
        eventStart,
        eventEndDate,
        eventEnd,
      })
      return
    }

    // Validate end date/time
    if (!validateEndDateTime()) {
      setError("Event end date and time must be after the start date and time")
      return
    }

    // Validate stop date
    if (enableStopDate && stopDate) {
      if (!validateStopDate()) {
        setError("Stop date must be at least 3 days before the event start date")
        return
      }
    }

    if (enablePricing && ticketPrices.length === 0) {
      setError("Please add at least one ticket type when pricing is enabled")
      return
    }

    if (enablePricing) {
      const hasInvalidTicket = ticketPrices.some((ticket) => !ticket.policy || !ticket.price)
      if (hasInvalidTicket) {
        setError("Please fill in all ticket details")
        return
      }
    }

    const allUploadsComplete = uploadedImageUrls.every((url) => url !== null)
    const stillUploading = isUploading.some((uploading) => uploading)

    if (eventImages.length > 0 && (!allUploadsComplete || stillUploading)) {
      setError("Please wait for all images to finish uploading")
      return
    }

    setLoading(true)

    try {
      console.log("[v0] Creating event with data:", {
        eventName,
        eventDate,
        eventStart,
        eventEndDate,
        eventEnd,
        userId: auth.currentUser.uid,
      })

      const uploadedUrls = uploadedImageUrls.filter((url): url is string => url !== null)
      const eventImage = uploadedUrls.length > 0 ? uploadedUrls[0] : null
      const eventImagesArray = uploadedUrls.slice(1)

      // Build event data with separate date/time fields
      const eventData: any = {
        eventName,
        eventDescription,
        eventImage,
        eventImages: eventImagesArray,
        eventDate, // Start date (YYYY-MM-DD)
        eventStart, // Start time (HH:MM)
        eventEndDate, // End date (YYYY-MM-DD)
        eventEnd, // End time (HH:MM)
        eventVenue,
        venueCoordinates: venueCoordinates || null,
        eventType,
        isFree: !enablePricing,
        ticketPrices: enablePricing ? ticketPrices : [],
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        status: "active",
        ticketsSold: 0,
        revenue: 0,
        enabledCollaboration,
        allowAgents: enabledCollaboration ? allowAgents : false,
      }

      // Only add stop date if enabled and set
      if (enableStopDate && stopDate) {
        eventData.hasStopDate = true
        eventData.stopDate = new Date(stopDate)
      } else {
        eventData.hasStopDate = false
        eventData.stopDate = null
      }

      console.log("[v0] Saving to user events collection...")
      const eventsRef = collection(db, "events", auth.currentUser.uid, "userEvents")
      const docRef = await addDoc(eventsRef, eventData)
      console.log("[v0] Event saved to user collection with ID:", docRef.id)

      console.log("[v0] Saving to public events collection...")
      const publicEventData = {
        imageURL: eventImage,
        eventType: eventType,
        venue: eventVenue,
        eventStartDate: eventDate, // Only the start date (YYYY-MM-DD)
        eventName: eventName,
        freeOrPaid:
          enablePricing && ticketPrices.length > 0 && ticketPrices.some((ticket) => ticket.policy && ticket.price),
        timestamp: serverTimestamp(),
        creatorID: auth.currentUser.uid,
        eventId: docRef.id,
        eventGroup: false,
      }
      await setDoc(doc(db, "publicEvents", eventName), publicEventData)
      console.log("[v0] Event saved to public events collection with name:", eventName)

      const payId = "PAY" + Math.random().toString(36).substring(2, 10).toUpperCase()
      const successUrl = `/create-event/success?eventId=${docRef.id}&payId=${payId}&type=one-time&eventName=${encodeURIComponent(eventName)}`

      console.log("[v0] Event created successfully, redirecting to:", successUrl)
      await new Promise((resolve) => setTimeout(resolve, 500))
      router.push(successUrl)
    } catch (err: any) {
      console.error("[v0] Error creating event:", err)
      console.error("[v0] Error details:", {
        message: err.message,
        code: err.code,
        stack: err.stack,
      })
      setError(err.message || "Failed to create event. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Preloader isLoading={loading} />

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8 pb-12">
        {/* Page Header */}
        <div className="text-center space-y-4 animate-in fade-in duration-700">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#6b2fa5] to-purple-600 rounded-2xl shadow-lg shadow-[#6b2fa5]/30 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-5xl font-bold bg-gradient-to-r from-[#6b2fa5] via-[#8b3fc5] to-[#6b2fa5] bg-clip-text text-transparent">
            Create One-Time Event
          </h1>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Fill in the details below to create your event. All fields marked with * are required.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex gap-3 p-4 rounded-xl bg-red-50 border-2 border-red-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900 mb-1">Error</p>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-6 rounded-xl border-2 border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 bg-[#6b2fa5]/10 rounded-lg">
              <Type className="w-5 h-5 text-[#6b2fa5]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Basic Information</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Event Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Summer Music Festival 2024"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Event Description <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <AlignLeft className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <textarea
                  placeholder="Describe your event in detail..."
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  required
                  rows={5}
                  className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900 placeholder:text-slate-400 resize-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Event Type <span className="text-red-500">*</span>
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900"
              >
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-6 rounded-xl border-2 border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 bg-[#6b2fa5]/10 rounded-lg">
              <MapPin className="w-5 h-5 text-[#6b2fa5]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Location</h2>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Event Venue <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter event venue or address"
                  value={eventVenue}
                  onChange={(e) => setEventVenue(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#6b2fa5] hover:bg-[#5a2589] text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap"
              >
                <MapPinned className="w-5 h-5" />
                Pick on Map
              </button>
            </div>
            {venueCoordinates && (
              <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                Location coordinates saved
              </p>
            )}
          </div>
        </div>

        {/* Date and Time */}
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
                  <p className="text-xs text-slate-500 mt-1">Event must be at least 2 days from today</p>
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
                    <p className="text-xs text-amber-600 mt-1">Set start date and time first</p>
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
                    <p className="text-xs text-amber-600 mt-1">Set start date and time first</p>
                  )}
                </div>
              </div>
              {eventEndDate && eventEnd && eventDate && eventStart && !validateEndDateTime() && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">End date and time must be after start date and time</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Images */}
        <div className="space-y-6 rounded-xl border-2 border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 bg-[#6b2fa5]/10 rounded-lg">
              <ImageIcon className="w-5 h-5 text-[#6b2fa5]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Event Images</h2>
          </div>

          <div className="space-y-5">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
                isDragging
                  ? "border-[#6b2fa5] bg-[#6b2fa5]/5 scale-[1.02]"
                  : "border-slate-300 hover:border-[#6b2fa5] hover:bg-slate-50"
              }`}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-2xl mb-4">
                <Upload className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-lg font-bold text-slate-900 mb-2">
                {eventImages.length === 0 ? "Upload Event Images" : "Add More Images"}
              </p>
              <p className="text-sm text-slate-600 mb-3">Drag and drop images here, or click to select files</p>
              <div className="inline-flex items-center gap-2 bg-[#6b2fa5]/10 border border-[#6b2fa5]/20 rounded-full px-4 py-2">
                <span className="text-xs font-semibold text-[#6b2fa5]">
                  Maximum 8 images • First image will be the main event image • {eventImages.length}/8 uploaded
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {imagePreviewUrls.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {imagePreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <div className="relative w-full h-44 rounded-xl overflow-hidden border-2 border-slate-200 group-hover:border-[#6b2fa5] transition-all duration-300">
                      <Image
                        src={url || "/placeholder.svg"}
                        alt={`Event image ${index + 1}`}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />

                      {index === 0 && (
                        <div className="absolute top-3 left-3 bg-gradient-to-r from-[#6b2fa5] to-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md">
                          Main Image
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeImage(index)
                        }}
                        className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md hover:scale-110"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      {isUploading[index] && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
                          <div className="w-3/4 h-2.5 bg-slate-700 rounded-full overflow-hidden mb-2">
                            <div
                              className="h-full bg-gradient-to-r from-[#6b2fa5] to-purple-500 transition-all duration-300"
                              style={{ width: `${uploadProgress[index] || 0}%` }}
                            />
                          </div>
                          <p className="text-white text-sm font-semibold">{uploadProgress[index] || 0}%</p>
                        </div>
                      )}

                      {uploadComplete[index] && (
                        <div className="absolute inset-0 bg-emerald-500/30 backdrop-blur-sm flex items-center justify-center">
                          <div className="bg-emerald-500 rounded-full p-3">
                            <CheckCircle className="h-8 w-8 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-start gap-2 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                All images are automatically uploaded to Spotix Servers for fast, reliable hosting.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="rounded-xl border-2 border-slate-200 bg-white p-8 shadow-sm">
          <AddPricing
            enablePricing={enablePricing}
            setEnablePricing={setEnablePricing}
            ticketPrices={ticketPrices}
            setTicketPrices={setTicketPrices}
          />
        </div>

        {/* Additional Settings */}
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
                  <p className="text-xs text-slate-600">Set a deadline for when ticket sales should stop</p>
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
                        Stop date must be at least 3 days before event start date. Maximum date:{" "}
                        {new Date(getMaxStopDate()).toLocaleDateString()}
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
                  <label className="text-sm font-semibold text-slate-900 block mb-1">Enable Collaboration</label>
                  <p className="text-xs text-slate-600">Allow team members to help manage this event</p>
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
                    <label className="text-sm font-semibold text-slate-900 block mb-1">Allow Agents</label>
                    <p className="text-xs text-slate-600">Enable agents to sell tickets for this event</p>
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

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || isUploading.some((uploading) => uploading)}
            className="flex-1 group inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-[#6b2fa5] to-purple-600 hover:from-[#5a2589] hover:to-[#6b2fa5] text-white font-bold text-lg rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-[#6b2fa5]/30 hover:shadow-xl hover:shadow-[#6b2fa5]/40 hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating Event...
              </>
            ) : isUploading.some((uploading) => uploading) ? (
              <>
                <Upload className="w-5 h-5 animate-pulse" />
                Uploading Images...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                Create Event
              </>
            )}
          </button>
        </div>
      </form>

      {/* Map Picker Modal */}
      <MapPickerModal
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onSelectLocation={(address, coordinates) => {
          setEventVenue(address)
          setVenueCoordinates(coordinates)
        }}
        currentAddress={eventVenue}
      />
    </>
  )
}