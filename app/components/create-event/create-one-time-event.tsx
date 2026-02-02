"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import { Preloader } from "@/components/preloader"
import { AddPricing } from "./add-pricing"
import { AlertCircle, Sparkles, CheckCircle } from "lucide-react"
import { uploadImage } from "@/lib/image-uploader"
import { MapPickerModal } from "./map-picker-modal"
import type { TicketType } from "@/types/ticket"

// Import helper components
import { EventBioData } from "./helper/EventBioData"
import { EventLocation } from "./helper/EventLocation"
import { EventDateTime } from "./helper/EventDateTime"
import { AdditionalSettings } from "./helper/AdditionalSettings"
import { Affiliates } from "./helper/Affiliates"
import { FormNavigation } from "./helper/FormNavigation"

interface CreateOneTimeEventProps {
  onSuccess?: () => void
}

export function CreateOneTimeEvent({ onSuccess }: CreateOneTimeEventProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [apiWarnings, setApiWarnings] = useState<string[]>([])
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 6

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
  const [enableStopDate, setEnableStopDate] = useState(false)
  const [stopDate, setStopDate] = useState("")
  const [enabledCollaboration, setEnabledCollaboration] = useState(false)
  const [allowAgents, setAllowAgents] = useState(false)
  const [verifiedAffiliate, setVerifiedAffiliate] = useState<{
    id: string
    name: string
  } | null>(null)

  // Upload states
  const [uploadProgress, setUploadProgress] = useState<number[]>([])
  const [isUploading, setIsUploading] = useState<boolean[]>([])
  const [uploadComplete, setUploadComplete] = useState<boolean[]>([])
  const [uploadedImageUrls, setUploadedImageUrls] = useState<(string | null)[]>([])
  const cancelUploadRefs = useRef<((() => void) | null)[]>([])

  const [venueCoordinates, setVenueCoordinates] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [showMapPicker, setShowMapPicker] = useState(false)

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
          console.log(`✅ Image ${index + 1} uploaded successfully to`, provider)
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
          console.error(`❌ Upload failed for image ${index + 1}: No URL returned`)
        }
      })
      .catch((error) => {
        console.error(`❌ Upload failed for image ${index + 1}:`, error)
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

  // Step validation
  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return !!eventName && !!eventDescription && !!eventType
      case 2:
        return !!eventVenue
      case 3:
        return !!eventDate && !!eventStart && !!eventEndDate && !!eventEnd && validateEndDateTime()
      case 4:
        return !enablePricing || ticketPrices.length > 0
      case 5:
        return !enableStopDate || !stopDate || validateStopDate()
      case 6:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (canProceedToNextStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps))
      setError("")
      setApiWarnings([])
    }
  }

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    setError("")
    setApiWarnings([])
  }

  const handleSubmit = async () => {
    setError("")
    setApiWarnings([])
    console.log("📝 Form submitted - starting validation")

    if (!auth.currentUser) {
      setError("You must be logged in to create an event")
      return
    }

    // Step 1 & 3 validation
    if (!eventName || !eventDate || !eventVenue || !eventStart || !eventEndDate || !eventEnd) {
      const missingFields = []
      if (!eventName) missingFields.push("event name (Step 1)")
      if (!eventVenue) missingFields.push("venue (Step 2)")
      if (!eventDate || !eventStart || !eventEndDate || !eventEnd) missingFields.push("date/time (Step 3)")
      
      setError(`Missing required fields: ${missingFields.join(", ")}`)
      return
    }

    // Step 3 validation - Date/Time
    if (!validateEndDateTime()) {
      setError("Step 3: Event end date and time must be after the start date and time")
      return
    }

    // Step 5 validation - Stop Date
    if (enableStopDate && stopDate) {
      if (!validateStopDate()) {
        setError("Step 5: Stop date must be at least 3 days before the event start date")
        return
      }
    }

    // Step 4 validation - Pricing
    if (enablePricing && ticketPrices.length === 0) {
      setError("Step 4: Please add at least one ticket type when pricing is enabled")
      return
    }

    if (enablePricing) {
      // Check if all tickets have required fields (policy name is required, price can be 0 for free tickets)
      const hasInvalidTicket = ticketPrices.some((ticket) => !ticket.policy || ticket.price === undefined || ticket.price === "")
      if (hasInvalidTicket) {
        setError("Step 4: Fix pricing details properly - each ticket must have a name and price (use 0 for free tickets)")
        return
      }

      // Validate that there's at least one ticket with a name
      const hasValidTicket = ticketPrices.some((ticket) => ticket.policy && ticket.policy.trim() !== "")
      if (!hasValidTicket) {
        setError("Step 4: Fix pricing details properly - at least one ticket must have a valid name")
        return
      }
    }

    const allUploadsComplete = uploadedImageUrls.every((url) => url !== null)
    const stillUploading = isUploading.some((uploading) => uploading)

    if (eventImages.length > 0 && (!allUploadsComplete || stillUploading)) {
      setError("Step 1: Please wait for all images to finish uploading")
      return
    }

    setLoading(true)

    try {
      console.log("🚀 Creating event via API with data:", {
        eventName,
        eventDate,
        eventStart,
        eventEndDate,
        eventEnd,
        userId: auth.currentUser.uid,
      })

      const uploadedUrls = uploadedImageUrls.filter((url): url is string => url !== null)

      // Prepare the request body for the API
      const requestBody = {
        userId: auth.currentUser.uid,
        eventName,
        eventDescription,
        eventImages: uploadedUrls,
        eventDate,
        eventVenue,
        venueCoordinates: venueCoordinates || null,
        eventStart,
        eventEnd,
        eventEndDate,
        eventType,
        enablePricing,
        ticketPrices: enablePricing ? ticketPrices : [],
        enableStopDate,
        stopDate: enableStopDate && stopDate ? stopDate : null,
        enabledCollaboration,
        allowAgents: enabledCollaboration ? allowAgents : false,
        affiliateId: verifiedAffiliate ? verifiedAffiliate.id : null,
      }

      console.log("📤 Sending request to API...")

      // Call the API endpoint
      const response = await fetch("/api/event/one", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle API errors
        console.error("❌ API Error:", data)
        throw new Error(data.message || "Failed to create event")
      }

      console.log("✅ Event created successfully:", data)

      // Show warnings if any
      if (data.warnings && data.warnings.length > 0) {
        setApiWarnings(data.warnings)
        console.warn("⚠️ API Warnings:", data.warnings)
      }

      // Generate success URL with payId
      const payId = "PAY" + Math.random().toString(36).substring(2, 10).toUpperCase()
      const successUrl = `/create-event/success?eventId=${data.eventId}&payId=${payId}&type=one-time&eventName=${encodeURIComponent(eventName)}`

      console.log("🎉 Event created successfully, redirecting to:", successUrl)
      
      // Small delay to ensure everything is processed
      await new Promise((resolve) => setTimeout(resolve, 500))
      
      // Redirect to success page
      router.push(successUrl)

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      console.error("❌ Error creating event:", err)
      console.error("❌ Error details:", {
        message: err.message,
        stack: err.stack,
      })
      setError(err.message || "Failed to create event. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <EventBioData
            eventName={eventName}
            setEventName={setEventName}
            eventDescription={eventDescription}
            setEventDescription={setEventDescription}
            eventType={eventType}
            setEventType={setEventType}
            eventImages={eventImages}
            setEventImages={setEventImages}
            imagePreviewUrls={imagePreviewUrls}
            setImagePreviewUrls={setImagePreviewUrls}
            uploadProgress={uploadProgress}
            setUploadProgress={setUploadProgress}
            isUploading={isUploading}
            setIsUploading={setIsUploading}
            uploadComplete={uploadComplete}
            setUploadComplete={setUploadComplete}
            uploadedImageUrls={uploadedImageUrls}
            setUploadedImageUrls={setUploadedImageUrls}
            onStartUpload={startBackgroundUpload}
            onRemoveImage={removeImage}
          />
        )
      case 2:
        return (
          <EventLocation
            eventVenue={eventVenue}
            setEventVenue={setEventVenue}
            venueCoordinates={venueCoordinates}
            setVenueCoordinates={setVenueCoordinates}
            onOpenMapPicker={() => setShowMapPicker(true)}
          />
        )
      case 3:
        return (
          <EventDateTime
            eventDate={eventDate}
            setEventDate={setEventDate}
            eventStart={eventStart}
            setEventStart={setEventStart}
            eventEndDate={eventEndDate}
            setEventEndDate={setEventEndDate}
            eventEnd={eventEnd}
            setEventEnd={setEventEnd}
            getMinDate={getMinDate}
            validateEndDateTime={validateEndDateTime}
          />
        )
      case 4:
        return (
          <div className="rounded-xl border-2 border-slate-200 bg-white p-8 shadow-sm">
            <AddPricing
              enablePricing={enablePricing}
              setEnablePricing={setEnablePricing}
              ticketPrices={ticketPrices}
              setTicketPrices={setTicketPrices}
            />
          </div>
        )
      case 5:
        return (
          <AdditionalSettings
            enableStopDate={enableStopDate}
            setEnableStopDate={setEnableStopDate}
            stopDate={stopDate}
            setStopDate={setStopDate}
            eventDate={eventDate}
            getMaxStopDate={getMaxStopDate}
            validateStopDate={validateStopDate}
            enabledCollaboration={enabledCollaboration}
            setEnabledCollaboration={setEnabledCollaboration}
            allowAgents={allowAgents}
            setAllowAgents={setAllowAgents}
          />
        )
      case 6:
        return (
          <Affiliates
            verifiedAffiliate={verifiedAffiliate}
            setVerifiedAffiliate={setVerifiedAffiliate}
          />
        )
      default:
        return null
    }
  }

  return (
    <>
      <Preloader isLoading={loading} />

      <div className="max-w-5xl mx-auto space-y-8 pb-12">
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

          {/* Step Titles */}
          <div className="flex justify-center items-center gap-2 flex-wrap mt-6">
            <span
              className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
                currentStep === 1 ? "bg-[#6b2fa5] text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              1. Event Info
            </span>
            <span className="text-slate-400">→</span>
            <span
              className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
                currentStep === 2 ? "bg-[#6b2fa5] text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              2. Location
            </span>
            <span className="text-slate-400">→</span>
            <span
              className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
                currentStep === 3 ? "bg-[#6b2fa5] text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              3. Date & Time
            </span>
            <span className="text-slate-400">→</span>
            <span
              className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
                currentStep === 4 ? "bg-[#6b2fa5] text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              4. Pricing
            </span>
            <span className="text-slate-400">→</span>
            <span
              className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
                currentStep === 5 ? "bg-[#6b2fa5] text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              5. Settings
            </span>
            <span className="text-slate-400">→</span>
            <span
              className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
                currentStep === 6 ? "bg-[#6b2fa5] text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              6. Affiliate
            </span>
          </div>
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

        {/* API Warnings */}
        {apiWarnings.length > 0 && (
          <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border-2 border-amber-200 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900 mb-2">Warnings</p>
              <ul className="space-y-1">
                {apiWarnings.map((warning, index) => (
                  <li key={index} className="text-amber-800 text-sm">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Current Step Content */}
        {renderStep()}

        {/* Navigation */}
        <FormNavigation
          currentStep={currentStep}
          totalSteps={totalSteps}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSubmit={handleSubmit}
          isSubmitting={loading}
          isUploading={isUploading.some((uploading) => uploading)}
          canProceed={canProceedToNextStep()}
        />
      </div>

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