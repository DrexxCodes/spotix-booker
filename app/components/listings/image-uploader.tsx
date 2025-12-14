"use client"

import type React from "react"

import { useState, useRef } from "react"
import Image from "next/image"
import { GripVertical, X } from "lucide-react"

interface ImageUploaderProps {
  images: File[]
  setImages: (images: File[]) => void
}

export function ImageUploader({ images, setImages }: ImageUploaderProps) {
  const [previews, setPreviews] = useState<string[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newImages = [...images, ...files].slice(0, 6)
    setImages(newImages)
    updatePreviews(newImages)
  }

  const updatePreviews = (imageList: File[]) => {
    const newPreviews = imageList.map((file) => URL.createObjectURL(file))
    setPreviews(newPreviews)
  }

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    setImages(newImages)
    updatePreviews(newImages)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newImages = [...images]
    const draggedImage = newImages[draggedIndex]
    newImages.splice(draggedIndex, 1)
    newImages.splice(index, 0, draggedImage)

    const draggedPreview = previews[draggedIndex]
    const newPreviews = [...previews]
    newPreviews.splice(draggedIndex, 1)
    newPreviews.splice(index, 0, draggedPreview)

    setImages(newImages)
    setPreviews(newPreviews)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  return (
    <div className="space-y-4">
      {/* Image Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {previews.map((preview, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className="relative group cursor-move"
          >
            <div className="relative w-full aspect-square bg-secondary rounded-lg overflow-hidden">
              <Image src={preview || "/placeholder.svg"} alt={`Preview ${index}`} fill className="object-cover" />
              {index === 0 && (
                <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded font-semibold">
                  Cover Image
                </div>
              )}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                <GripVertical className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>
        ))}

        {/* Upload Button */}
        {images.length < 6 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-primary rounded-lg p-8 flex flex-col items-center justify-center hover:bg-secondary transition-colors"
          >
            <div className="text-4xl mb-2">+</div>
            <p className="text-sm font-medium text-foreground">Add Image</p>
            <p className="text-xs text-muted-foreground">{6 - images.length} remaining</p>
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
        disabled={images.length >= 6}
      />
    </div>
  )
}
