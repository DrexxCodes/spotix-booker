"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Plus, X, AlertCircle, Calendar, MapPin, Clock, Tag, Ticket, DollarSign, Users, FileText, Upload, Image as ImageIcon } from "lucide-react"
import { db } from "@/lib/firebase"
import { storage } from "@/lib/firebase"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { doc, updateDoc } from "firebase/firestore"
import Image from "next/image"

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
}: EditEventTabProps) {
  const [errorMessage, setErrorMessage] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>(editFormData.eventImage || "")

  useEffect(() => {
    setImagePreview(editFormData.eventImage || "")
  }, [editFormData.eventImage])

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
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Create a storage reference - use timestamp for unique filename
      const timestamp = Date.now()
      const fileExtension = file.name.split('.').pop()
      const fileName = `${timestamp}.${fileExtension}`
      const storageRef = ref(storage, `events/${fileName}`)

      // Upload the file
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Calculate upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(Math.round(progress))
        },
        (error) => {
          console.error('Upload error:', error)
          alert('Failed to upload image. Please try again.')
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
                  eventImage: downloadURL
                })
                alert('Image uploaded and saved successfully!')
              } catch (firestoreError) {
                console.error('Error updating Firestore:', firestoreError)
                alert('Image uploaded to storage, but failed to update event. Please click "Save Changes" to retry.')
              }
            } else {
              alert('Image uploaded successfully! Click "Save Changes" to update your event.')
            }
          } catch (error) {
            console.error('Error getting download URL:', error)
            alert('Failed to get image URL. Please try again.')
          } finally {
            setIsUploading(false)
            setUploadProgress(0)
          }
        }
      )
    } catch (error) {
      console.error('Error initializing upload:', error)
      alert('Failed to start upload. Please try again.')
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const removeImage = () => {
    setEditFormData({ ...editFormData, eventImage: "" })
    setImagePreview("")
  }

  return (
    <div className="space-y-6">
      {/* Event Image Upload Section */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-lg">
            <ImageIcon size={20} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Event Image</h3>
        </div>

        <div className="space-y-4">
          {/* Image Preview */}
          {imagePreview && (
            <div className="relative w-full h-64 sm:h-80 rounded-xl overflow-hidden border-2 border-slate-200 group">
              <Image
                src={imagePreview}
                alt="Event preview"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <button
                  type="button"
                  onClick={removeImage}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <X size={18} />
                  Remove Image
                </button>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={isUploading}
              className="hidden"
              id="event-image-upload"
            />
            <label
              htmlFor="event-image-upload"
              className={`flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                isUploading
                  ? 'border-slate-300 bg-slate-50 cursor-not-allowed'
                  : 'border-slate-300 hover:border-[#6b2fa5] hover:bg-[#6b2fa5]/5'
              }`}
            >
              <Upload size={40} className={`mb-3 ${isUploading ? 'text-slate-400' : 'text-[#6b2fa5]'}`} />
              <p className="text-sm font-semibold text-slate-700 mb-1">
                {isUploading ? 'Uploading...' : imagePreview ? 'Change Event Image' : 'Upload Event Image'}
              </p>
              <p className="text-xs text-slate-500">PNG, JPG, WEBP up to 5MB</p>
            </label>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Uploading...</span>
                <span className="font-bold text-[#6b2fa5]">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#6b2fa5] to-[#8b4fc5] h-3 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${uploadProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {/* Hidden input to store image URL */}
          <input
            type="hidden"
            name="eventImage"
            value={editFormData.eventImage || ""}
          />
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