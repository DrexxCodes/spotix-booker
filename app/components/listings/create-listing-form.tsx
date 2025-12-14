"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { getApp } from "firebase/app"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { FileText, DollarSign, CheckCircle2, ChevronLeft, ChevronRight, X, Upload, ImagePlus } from "lucide-react"
import Image from "next/image"

interface CreateListingFormProps {
  userId: string
}

export function CreateListingForm({ userId }: CreateListingFormProps) {
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [productName, setProductName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const uploadImagesToFirebase = async (files: File[]): Promise<string[]> => {
    console.log("🔥 Starting image upload to Firebase Storage...")
    console.log(`📸 Total images to upload: ${files.length}`)

    const app = getApp()
    const storage = getStorage(app)
    const uploadedUrls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`
      const storagePath = `listings/${userId}/${fileName}`

      console.log(`📤 Uploading image ${i + 1}/${files.length}: ${file.name}`)
      console.log(`📁 Storage path: ${storagePath}`)

      setUploadStatus(`Uploading image ${i + 1} of ${files.length}...`)
      setUploadProgress(Math.round(((i + 1) / files.length) * 100))

      try {
        const storageRef = ref(storage, storagePath)
        const snapshot = await uploadBytes(storageRef, file)
        console.log(`✅ Upload successful for ${file.name}`)

        const downloadURL = await getDownloadURL(snapshot.ref)
        console.log(`🔗 Download URL obtained: ${downloadURL.substring(0, 50)}...`)

        uploadedUrls.push(downloadURL)
      } catch (error) {
        console.error(`❌ Error uploading ${file.name}:`, error)
        throw error
      }
    }

    console.log(`✅ All ${files.length} images uploaded successfully`)
    return uploadedUrls
  }

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return

    const newFiles = Array.from(files).filter((file) => file.type.startsWith("image/"))
    const totalImages = images.length + newFiles.length

    console.log(`📁 Files selected: ${newFiles.length}`)
    console.log(`📊 Total images after selection: ${totalImages}`)

    if (totalImages > 6) {
      setErrors({ images: "Maximum 6 images allowed" })
      console.log("⚠️ Too many images, limit is 6")
      return
    }

    const newImages = [...images, ...newFiles]
    setImages(newImages)

    const newPreviews = newFiles.map((file) => URL.createObjectURL(file))
    setImagePreviews([...imagePreviews, ...newPreviews])
    setErrors({ ...errors, images: "" })

    console.log("✅ Images added to form")
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
    console.log("📦 Files dropped")
    handleFileSelect(e.dataTransfer.files)
  }

  const moveImageLeft = (index: number) => {
    if (index === 0) return
    const newImages = [...images]
    const newPreviews = [...imagePreviews]
    ;[newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]]
    ;[newPreviews[index - 1], newPreviews[index]] = [newPreviews[index], newPreviews[index - 1]]

    setImages(newImages)
    setImagePreviews(newPreviews)
    console.log(`⬅️ Moved image from position ${index} to ${index - 1}`)
  }

  const moveImageRight = (index: number) => {
    if (index === images.length - 1) return
    const newImages = [...images]
    const newPreviews = [...imagePreviews]
    ;[newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]]
    ;[newPreviews[index], newPreviews[index + 1]] = [newPreviews[index + 1], newPreviews[index]]

    setImages(newImages)
    setImagePreviews(newPreviews)
    console.log(`➡️ Moved image from position ${index} to ${index + 1}`)
  }

  const removeImage = (index: number) => {
    console.log(`🗑️ Removing image at position ${index}`)
    const newImages = images.filter((_, i) => i !== index)
    const newPreviews = imagePreviews.filter((_, i) => i !== index)

    URL.revokeObjectURL(imagePreviews[index])

    setImages(newImages)
    setImagePreviews(newPreviews)
    console.log(`✅ Image removed, ${newImages.length} images remaining`)
  }

  const validateForm = () => {
    console.log("🔍 Validating form...")
    const newErrors: Record<string, string> = {}

    if (!productName.trim()) {
      newErrors.productName = "Product name is required"
      console.log("❌ Product name is missing")
    }
    if (!description.trim()) {
      newErrors.description = "Description is required"
      console.log("❌ Description is missing")
    }
    if (!price || Number.parseFloat(price) <= 0) {
      newErrors.price = "Valid price is required"
      console.log("❌ Valid price is missing")
    }
    if (images.length === 0) {
      newErrors.images = "At least 1 image is required"
      console.log("❌ No images provided")
    }
    if (images.length > 6) {
      newErrors.images = "Maximum 6 images allowed"
      console.log("❌ Too many images")
    }

    setErrors(newErrors)
    const isValid = Object.keys(newErrors).length === 0
    console.log(isValid ? "✅ Form validation passed" : "❌ Form validation failed")
    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("🚀 Form submission started")
    console.log("📝 Form data:", { productName, description, price, imageCount: images.length })

    if (!validateForm()) {
      console.log("⚠️ Form validation failed, aborting submission")
      return
    }

    setLoading(true)
    setUploadProgress(0)
    setUploadStatus("Preparing to upload...")

    try {
      console.log("📤 Starting image upload process...")
      const imageUrls = await uploadImagesToFirebase(images)
      console.log(`✅ All images uploaded, received ${imageUrls.length} URLs`)

      setUploadStatus("Saving product details...")
      setUploadProgress(100)

      const app = getApp()
      const db = getFirestore(app)
      const listingRef = collection(db, "listing", userId, "products")

      const productData = {
        productName,
        description,
        price: Number.parseFloat(price),
        images: imageUrls,
        createdAt: serverTimestamp(),
      }

      console.log("💾 Saving to Firestore...")
      console.log("📍 Collection path:", `listing/${userId}/products`)
      console.log("📦 Product data:", productData)

      const docRef = await addDoc(listingRef, productData)
      console.log(`✅ Document created with ID: ${docRef.id}`)

      console.log("🧹 Cleaning up preview URLs...")
      imagePreviews.forEach((preview) => URL.revokeObjectURL(preview))

      console.log("🎉 Success! Redirecting to success page...")
      router.push("/listings/success")
    } catch (error) {
      console.error("❌ Error creating listing:", error)
      console.error("📊 Error details:", {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack,
      })
      setErrors({ submit: "Failed to create listing. Please try again." })
      setUploadStatus("")
      setUploadProgress(0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#6b2fa5] to-[#8b3fc5] rounded-2xl shadow-lg shadow-[#6b2fa5]/30 mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Create New Listing</h2>
        <p className="text-gray-600">Add your product details and upload images to get started</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-8 animate-in fade-in zoom-in-95 duration-700">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#6b2fa5]/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[#6b2fa5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <label className="block text-lg font-bold text-gray-900">Product Images</label>
              <p className="text-sm text-gray-600">First image will be the cover photo. Use arrows to reorder.</p>
            </div>
          </div>

          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative group">
                  <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200 group-hover:border-[#6b2fa5] transition-all duration-200">
                    <Image
                      src={preview || "/placeholder.svg"}
                      alt={`Preview ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                    {index === 0 && (
                      <div className="absolute top-2 right-2 bg-[#6b2fa5] text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
                        Cover
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-1 mt-2">
                    <button
                      type="button"
                      onClick={() => moveImageLeft(index)}
                      disabled={index === 0}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
                      title="Move left"
                    >
                      <ChevronLeft size={16} className="text-gray-700" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200"
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImageRight(index)}
                      disabled={index === images.length - 1}
                      className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
                      title="Move right"
                    >
                      <ChevronRight size={16} className="text-gray-700" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {images.length < 6 && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-[#6b2fa5] bg-[#6b2fa5]/5"
                  : "border-gray-300 hover:border-[#6b2fa5] hover:bg-gray-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-[#6b2fa5]/10 rounded-full flex items-center justify-center">
                  {isDragging ? (
                    <Upload className="w-8 h-8 text-[#6b2fa5] animate-bounce" />
                  ) : (
                    <ImagePlus className="w-8 h-8 text-[#6b2fa5]" />
                  )}
                </div>
                <div>
                  <p className="text-gray-900 font-semibold mb-1">
                    {isDragging ? "Drop images here" : "Drag & drop images here"}
                  </p>
                  <p className="text-sm text-gray-600">
                    or click to browse • Max 6 images • {6 - images.length} remaining
                  </p>
                </div>
              </div>
            </div>
          )}

          {errors.images && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.images}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200"></div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <label className="block text-sm font-bold text-gray-900">Product Name *</label>
          </div>
          <Input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Enter product name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 hover:border-gray-400"
          />
          {errors.productName && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.productName}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </div>
            <label className="block text-sm font-bold text-gray-900">Description *</label>
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter product description"
            className="w-full min-h-[140px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 hover:border-gray-400 resize-none"
          />
          {errors.description && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.description}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#6b2fa5]/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#6b2fa5]" />
            </div>
            <label className="block text-sm font-bold text-gray-900">Price (₦) *</label>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">₦</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 hover:border-gray-400"
            />
          </div>
          {errors.price && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.price}
            </div>
          )}
        </div>

        {errors.submit && (
          <div className="bg-red-50 border-2 border-red-300 text-red-700 px-4 py-4 rounded-xl text-sm font-medium flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            {errors.submit}
          </div>
        )}

        {loading && (
          <div className="bg-[#6b2fa5]/5 border border-[#6b2fa5]/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[#6b2fa5]">{uploadStatus}</span>
              <span className="text-gray-600">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#6b2fa5] to-[#8b3fc5] transition-all duration-300 ease-out rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#6b2fa5] to-[#8b3fc5] hover:from-[#5a2789] hover:to-[#6b2fa5] text-white py-4 font-bold rounded-xl transition-all duration-200 shadow-lg shadow-[#6b2fa5]/30 hover:shadow-xl hover:shadow-[#6b2fa5]/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Creating Product...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Create Product</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
