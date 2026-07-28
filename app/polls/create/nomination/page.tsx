"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ImagePlus, Plus, X, AlertCircle } from "lucide-react"
import { doUpload } from "../lib/factories"
import { MAX_NOMINATION_CATEGORIES } from "@/lib/nomination-config"

export default function CreateNominationPollPage() {
  const router = useRouter()

  const [pollName, setPollName] = useState("")
  const [pollDescription, setPollDescription] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [categoryNames, setCategoryNames] = useState<string[]>([""])

  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleImage = async (file: File | undefined) => {
    if (!file) return
    const preview = URL.createObjectURL(file)
    setImagePreview(preview)
    setImageUploading(true)
    const url = await doUpload(file, "spotix/polls/nominations")
    setImageUrl(url)
    setImageUploading(false)
  }

  const updateCategory = (i: number, value: string) => {
    const next = [...categoryNames]; next[i] = value; setCategoryNames(next)
  }
  const addCategory = () => {
    if (categoryNames.length >= MAX_NOMINATION_CATEGORIES) return
    setCategoryNames([...categoryNames, ""])
  }
  const removeCategory = (i: number) => setCategoryNames(categoryNames.filter((_, idx) => idx !== i))

  const validate = (): string[] => {
    const e: string[] = []
    if (!pollName.trim()) e.push("Poll name is required")
    if (!imageUrl) e.push("Poll image is required")
    const trimmed = categoryNames.map((c) => c.trim()).filter(Boolean)
    if (trimmed.length === 0) e.push("At least 1 category is required")
    const seen = new Set<string>()
    for (const c of trimmed) {
      const key = c.toLowerCase()
      if (seen.has(key)) { e.push(`Category "${c}" is duplicated`); break }
      seen.add(key)
    }
    return e
  }

  const handleSubmit = async () => {
    const stepErrors = validate()
    if (stepErrors.length > 0) { setErrors(stepErrors); return }
    setErrors([])
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch("/api/polls/nominations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollName,
          pollImage: imageUrl,
          pollDescription,
          categories: categoryNames.map((c) => c.trim()).filter(Boolean).map((name) => ({ name })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error || "Failed to create nomination poll"); return }

      router.push(`/polls/create?imported=${data.pollId}`)
    } catch {
      setSubmitError("An unexpected error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Create a Nomination Poll</h1>
      <p className="text-slate-500 text-sm mb-6">
        Set a name, image, and categories — anyone can then nominate candidates into each category.
        You can import the nominees straight into a real poll's contestant list later.
      </p>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Poll Name</label>
          <input
            type="text"
            placeholder="e.g. Best Dressed Nominations 2026"
            value={pollName}
            onChange={(e) => setPollName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Image</label>
          <label className="relative block h-40 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#6b2fa5] cursor-pointer overflow-hidden transition-colors">
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <ImagePlus className="w-7 h-7 mb-2" />
                <p className="text-sm">Click to upload</p>
              </div>
            )}
            {imageUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
          </label>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Description (optional)</label>
          <textarea
            rows={3}
            placeholder="What are people nominating for?"
            value={pollDescription}
            onChange={(e) => setPollDescription(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Categories</label>
          <p className="text-xs text-slate-400 mb-3">
            Each category gets its own independent nomination pool — e.g. "Best Dressed", "Most Likely to Succeed".
          </p>
          <div className="space-y-2">
            {categoryNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Category ${i + 1} name`}
                  value={name}
                  onChange={(e) => updateCategory(i, e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5]"
                />
                {categoryNames.length > 1 && (
                  <button onClick={() => removeCategory(i)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addCategory}
            disabled={categoryNames.length >= MAX_NOMINATION_CATEGORIES}
            className="flex items-center gap-1.5 text-sm font-medium text-[#6b2fa5] hover:bg-[#6b2fa5]/5 px-3 py-1.5 rounded-lg transition-colors mt-2 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Add Category
          </button>
        </div>

        {errors.length > 0 && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {e}
              </p>
            ))}
          </div>
        )}
        {submitError && (
          <p className="text-xs text-red-600 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {submitError}
          </p>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSubmit}
          disabled={submitting || imageUploading}
          className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#6b2fa5] hover:bg-[#5a1f8a] disabled:opacity-60 transition-colors"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Nomination Poll"}
        </button>
      </div>
    </div>
  )
}
