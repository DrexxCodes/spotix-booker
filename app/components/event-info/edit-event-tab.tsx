"use client"

import React from "react"

import type { ReactElement } from "react"
import { useState, useEffect } from "react"
import {
  Plus,
  X,
  AlertCircle,
  Calendar,
  MapPin,
  Clock,
  Tag,
  Ticket,
  DollarSign,
  Users,
  FileText,
  Upload,
  ImageIcon,
  HelpCircle,
} from "lucide-react"
import { db } from "@/lib/firebase"
import { storage } from "@/lib/firebase"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { doc, updateDoc } from "firebase/firestore"
import Image from "next/image" // Imported Image
import { uploadImage } from "@/lib/image-uploader" // Imported uploadImage

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
  userId: string
  eventId: string
}

export default function EditEventTab({
  editFormData,
  handleInputChange,
  handleTicketPriceChange,
  addTicketPrice,
  handleSubmitEdit,
  setEditFormData,
  userId,
  eventId,
}: EditEventTabProps): ReactElement {
  const [errorMessage, setErrorMessage] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>(editFormData.eventImage || "")
  const [eventImages, setEventImages] = useState<string[]>(editFormData.eventImages || [])
  const [isUploadingImages, setIsUploadingImages] = useState<boolean[]>([])
  const [imageUploadProgress, setImageUploadProgress] = useState<number[]>([])
  const fileInputRef = React.createRef<HTMLInputElement>() // Added fileInputRef

  useEffect(() => {
    setImagePreview(editFormData.eventImage || "")
  }, [editFormData.eventImage])

  // Initialize eventImages state from editFormData
  useEffect(() => {
    setEventImages(editFormData.eventImages || [])
  }, [editFormData.eventImages])

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB")
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Create a storage reference - use timestamp for unique filename
      const timestamp = Date.now()
      const fileExtension = file.name.split(".").pop()
      const fileName = `${timestamp}.${fileExtension}`
      const storageRef = ref(storage, `events/${fileName}`)

      // Upload the file
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Calculate upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(Math.round(progress))
        },
        (error) => {
          console.error("Upload error:", error)
          alert("Failed to upload image. Please try again.")
          setIsUploading(false)
          setUploadProgress(0)
        },
        async () => {
          // Upload completed successfully
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)

            // Update the form data with new image URL
            setEditFormData({ ...editFormData, eventImage: downloadURL })
            setImagePreview(downloadURL)

            // Update Firestore document immediately if userId and eventId are available
            if (userId && eventId) {
              try {
                const eventDocRef = doc(db, "events", userId, "userEvents", eventId)
                await updateDoc(eventDocRef, {
                  eventImage: downloadURL,
                })
                alert("Image uploaded and saved successfully!")
              } catch (firestoreError) {
                console.error("Error updating Firestore:", firestoreError)
                alert('Image uploaded to storage, but failed to update event. Please click "Save Changes" to retry.')
              }
            } else {
              alert('Image uploaded successfully! Click "Save Changes" to update your event.')
            }
          } catch (error) {
            console.error("Error getting download URL:", error)
            alert("Failed to get image URL. Please try again.")
          } finally {
            setIsUploading(false)
            setUploadProgress(0)
          }
        },
      )
    } catch (error) {
      console.error("Error initializing upload:", error)
      alert("Failed to start upload. Please try again.")
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const removeImage = () => {
    setEditFormData({ ...editFormData, eventImage: "" })
    setImagePreview("")
  }

  const handleEventImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB")
      return
    }

    setIsUploadingImages((prev) => {
      const newState = [...prev]
      newState[index] = true
      return newState
    })

    try {
      const { uploadPromise } = uploadImage(file, {
        cloudinaryFolder: "Events",
        onProgress: (progress) => {
          setImageUploadProgress((prev) => {
            const newState = [...prev]
            newState[index] = progress
            return newState
          })
        },
      })

      const result = await uploadPromise

      if (result.url) {
        const newImages = [...eventImages]
        newImages[index] = result.url
        setEventImages(newImages)
        setEditFormData({ ...editFormData, eventImages: newImages })
        alert("Image uploaded successfully!")
      } else {
        alert("Failed to upload image. Please try again.")
      }
    } catch (error) {
      console.error("Error uploading image:", error)
      alert("Failed to upload image. Please try again.")
    } finally {
      setIsUploadingImages((prev) => {
        const newState = [...prev]
        newState[index] = false
        return newState
      })
    }
  }

  const handleEventImageUrlChange = (index: number, url: string) => {
    const newImages = [...eventImages]
    newImages[index] = url
    setEventImages(newImages)
    setEditFormData({ ...editFormData, eventImages: newImages })
  }

  const removeEventImage = (index: number) => {
    const newImages = eventImages.filter((_, i) => i !== index)
    setEventImages(newImages)
    setEditFormData({ ...editFormData, eventImages: newImages })
  }

  const addEventImage = () => {
    if (eventImages.length < 8) {
      const newImages = [...eventImages, ""]
      setEventImages(newImages)
      setEditFormData({ ...editFormData, eventImages: newImages })
    }
  }

  return (
    <div className="space-y-6">
      {/* Event Image Upload Section - READ ONLY */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-lg">
            <ImageIcon size={20} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Main Event Image</h3>
          <div className="group relative">
            {" "}
            {/* Added tooltip for HelpCircle */}
            <HelpCircle size={18} className="text-slate-400 cursor-help" />
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-10">
              To edit this, please contact support
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Image Preview */}
          {imagePreview && (
            <div className="relative w-full h-64 sm:h-80 rounded-xl overflow-hidden border-2 border-slate-200">
              <Image // Changed img to next/image.Image
                src={imagePreview || "/placeholder.svg"}
                alt="Event preview"
                fill // Added fill prop
                className="object-cover"
              />
            </div>
          )}

          {/* Disabled message */}
          <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-xl">
            <p className="text-sm text-slate-600">
              The main event image cannot be edited. Please contact support if you need to change it.
            </p>
          </div>

          {/* Hidden input to store image URL */}
          <input type="hidden" name="eventImage" value={editFormData.eventImage || ""} />
        </div>
      </div>

      {/* Other Event Images Section */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-lg">
            <ImageIcon size={20} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Additional Event Images</h3>
        </div>

        <p className="text-sm text-slate-600 mb-6">
          Add up to 8 additional images. Edit the URL directly or upload a new image using the button.
        </p>

        <div className="space-y-4">
          {eventImages.map((imageUrl, index) => (
            <div key={index} className="space-y-3 p-4 bg-slate-50 rounded-xl border-2 border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">Image {index + 1}</label>
                <button
                  type="button"
                  onClick={() => removeEventImage(index)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Image URL input */}
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Image URL</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => handleEventImageUrlChange(index, e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200 text-sm"
                />
              </div>

              {/* Upload button */}
              <div>
                <input
                  ref={fileInputRef} // Assigned fileInputRef
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleEventImageUpload(e, index)}
                  disabled={isUploadingImages[index]}
                  className="hidden"
                  id={`image-upload-${index}`}
                />
                <label
                  htmlFor={`image-upload-${index}`}
                  className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer text-sm font-semibold ${
                    isUploadingImages[index]
                      ? "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "border-[#6b2fa5]/30 hover:border-[#6b2fa5] hover:bg-[#6b2fa5]/5 text-[#6b2fa5]"
                  }`}
                >
                  <Upload size={16} />
                  {isUploadingImages[index] ? `Uploading... ${imageUploadProgress[index]}%` : "Upload Image"}
                </label>
              </div>

              {/* Image preview */}
              {imageUrl && (
                <div className="relative w-full h-40 rounded-lg overflow-hidden border-2 border-slate-200">
                  <Image // Changed img to next/image.Image
                    src={imageUrl || "/placeholder.svg"}
                    alt={`Event image ${index + 1}`}
                    fill // Added fill prop
                    className="object-cover"
                  />
                </div>
              )}
            </div>
          ))}

          {/* Add more images button */}
          {eventImages.length < 8 && (
            <button
              type="button"
              onClick={addEventImage}
              className="w-full px-4 py-3 border-2 border-dashed border-[#6b2fa5]/30 hover:border-[#6b2fa5] hover:bg-[#6b2fa5]/5 rounded-xl text-[#6b2fa5] font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Add Another Image ({eventImages.length}/8)
            </button>
          )}
        </div>
      </div>

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
              <div className="group relative">
                <HelpCircle size={16} className="text-slate-400 cursor-help" />
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-10">
                  To edit this, please contact support
                </div>
              </div>
            </label>
            <div className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-600 font-medium">
              {editFormData.eventName}
            </div>
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
                <div className="group relative">
                  <HelpCircle size={16} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-10">
                    To edit this, please contact support
                  </div>
                </div>
              </label>
              <div className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-600 font-medium">
                {editFormData.eventDate}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <MapPin size={16} className="text-[#6b2fa5]" />
                Event Venue
                <div className="group relative">
                  <HelpCircle size={16} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-10">
                    To edit this, please contact support
                  </div>
                </div>
              </label>
              <div className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-600 font-medium">
                {editFormData.eventVenue}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Calendar size={16} className="text-[#6b2fa5]" />
                End Date
                <div className="group relative">
                  <HelpCircle size={16} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-10">
                    To edit this, please contact support
                  </div>
                </div>
              </label>
              <div className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-slate-600 font-medium">
                {editFormData.eventEndDate}
              </div>
            </div>
            <div>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Tag size={16} className="text-[#6b2fa5]" />
              Event Category
            </label>
            <select
              name="eventCategory"
              value={editFormData.eventCategory}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
              required
            >
              <option value="">Select a category</option>
              <option value="Music">Music</option>
              <option value="Sports">Sports</option>
              <option value="Arts">Arts</option>
              <option value="Technology">Technology</option>
              <option value="Business">Business</option>
              <option value="Education">Education</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Capacity Settings */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-lg">
            <Users size={20} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Capacity Settings</h3>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <input
            type="checkbox"
            name="enableMaxSize"
            checked={editFormData.enableMaxSize}
            onChange={(e) => {
              setEditFormData({
                ...editFormData,
                enableMaxSize: e.target.checked,
              })
            }}
            className="w-5 h-5 rounded border-2 border-slate-300 text-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20 cursor-pointer"
          />
          <label className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
            Set Maximum Capacity
          </label>
        </div>

        {editFormData.enableMaxSize && (
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Users size={16} className="text-[#6b2fa5]" />
              Maximum Attendees
            </label>
            <input
              type="number"
              name="maxSize"
              min="1"
              value={editFormData.maxSize || ""}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
              placeholder="Enter maximum number of attendees"
              required={editFormData.enableMaxSize}
            />
          </div>
        )}
      </div>

      {/* Ticket Pricing */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-lg">
            <Ticket size={20} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Ticket Pricing</h3>
        </div>

        <div className="flex items-center gap-4 mb-6">
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
              <div
                key={index}
                className="p-5 border-2 border-slate-200 rounded-xl bg-gradient-to-br from-white to-slate-50 hover:shadow-md transition-all duration-200"
              >
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
          disabled={isUploading}
          className="flex-1 px-6 py-4 bg-gradient-to-r from-[#6b2fa5] to-[#8b4fc5] text-white rounded-xl font-bold hover:shadow-lg hover:shadow-[#6b2fa5]/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
