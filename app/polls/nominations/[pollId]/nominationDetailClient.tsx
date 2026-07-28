"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Loader2, ImagePlus, Plus, X, AlertCircle, CheckCircle,
  ChevronLeft, Tag, Users, Trash2, Save,
} from "lucide-react"
import { doUpload } from "@/polls/create/lib/factories"
import { MAX_NOMINATION_CATEGORIES } from "@/lib/nomination-config"
import { dicebearAvatarUrl } from "@/lib/dicebear"

interface NominationCategory {
  categoryId: string
  name: string
}

interface NominationPoll {
  pollId: string
  pollName: string
  pollImage: string
  pollDescription: string
  categories: NominationCategory[]
  status: "active" | "closed"
}

interface Nominee {
  nomineeId: string
  categoryId: string
  name: string
  count: number
}

export default function NominationDetailClient({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<NominationPoll | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Edit form state (mirrors poll once loaded)
  const [pollName, setPollName] = useState("")
  const [pollDescription, setPollDescription] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [categoryDrafts, setCategoryDrafts] = useState<NominationCategory[]>([])

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Nominees viewer
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [nominees, setNominees] = useState<Nominee[]>([])
  const [nomineesLoading, setNomineesLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/polls/nominations/${pollId}`)
        const data = await res.json()
        if (!res.ok) { setLoadError(data.error || "Failed to load nomination poll"); return }
        const p: NominationPoll = data.poll
        setPoll(p)
        setPollName(p.pollName)
        setPollDescription(p.pollDescription)
        setImagePreview(p.pollImage)
        setImageUrl(p.pollImage)
        setCategoryDrafts(p.categories)
        setActiveCategoryId(p.categories[0]?.categoryId ?? null)
      } catch {
        setLoadError("An unexpected error occurred while loading this poll.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [pollId])

  useEffect(() => {
    if (!activeCategoryId) return
    const load = async () => {
      setNomineesLoading(true)
      try {
        const res = await fetch(`/api/polls/nominations/${pollId}/nominees?categoryId=${activeCategoryId}`)
        const data = await res.json()
        if (res.ok) setNominees(data.nominees ?? [])
      } finally {
        setNomineesLoading(false)
      }
    }
    load()
  }, [pollId, activeCategoryId])

  const handleImage = async (file: File | undefined) => {
    if (!file) return
    const preview = URL.createObjectURL(file)
    setImagePreview(preview)
    setImageUploading(true)
    const url = await doUpload(file, "spotix/polls/nominations")
    setImageUrl(url)
    setImageUploading(false)
  }

  const updateCategoryName = (i: number, name: string) => {
    const next = [...categoryDrafts]; next[i] = { ...next[i], name }; setCategoryDrafts(next)
  }
  const addCategory = () => {
    if (categoryDrafts.length >= MAX_NOMINATION_CATEGORIES) return
    setCategoryDrafts([...categoryDrafts, { categoryId: "", name: "" }])
  }
  const removeCategoryDraft = (i: number) => setCategoryDrafts(categoryDrafts.filter((_, idx) => idx !== i))

  const toggleStatus = async () => {
    if (!poll) return
    const nextStatus = poll.status === "active" ? "closed" : "active"
    try {
      const res = await fetch(`/api/polls/nominations/${pollId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (res.ok) setPoll({ ...poll, status: nextStatus })
      else setSaveError(data.error || "Failed to update status")
    } catch {
      setSaveError("An unexpected error occurred")
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const cleanCategories = categoryDrafts
      .map((c) => ({ ...c, name: c.name.trim() }))
      .filter((c) => c.name)

    if (cleanCategories.length === 0) {
      setSaveError("At least 1 category is required")
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/polls/nominations/${pollId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollName,
          pollImage: imageUrl,
          pollDescription,
          categories: cleanCategories.map((c) => ({ categoryId: c.categoryId || undefined, name: c.name })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || "Failed to save changes"); return }

      // Refresh poll from server so categoryIds for new categories are correct
      const refreshed = await fetch(`/api/polls/nominations/${pollId}`).then((r) => r.json())
      if (refreshed.poll) {
        setPoll(refreshed.poll)
        setCategoryDrafts(refreshed.poll.categories)
        if (!refreshed.poll.categories.some((c: NominationCategory) => c.categoryId === activeCategoryId)) {
          setActiveCategoryId(refreshed.poll.categories[0]?.categoryId ?? null)
        }
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError("An unexpected error occurred. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-[#6b2fa5]" /></div>
  }

  if (loadError || !poll) {
    return <p className="text-center text-red-600 text-sm py-24">{loadError || "Nomination poll not found"}</p>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/polls/nominations" className="inline-flex items-center gap-1 text-[#6b2fa5] hover:text-[#5a1f8a] text-sm font-medium mb-6">
        <ChevronLeft className="w-4 h-4" /> Back to Nomination Polls
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Edit Nomination Poll</h1>
        <button
          onClick={toggleStatus}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
            ${poll.status === "active" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          {poll.status === "active" ? "Active — click to close" : "Closed — click to reopen"}
        </button>
      </div>

      {/* Edit form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5 mb-8">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Poll Name</label>
          <input type="text" value={pollName} onChange={(e) => setPollName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5]" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Image</label>
          <label className="relative block h-40 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#6b2fa5] cursor-pointer overflow-hidden transition-colors">
            {imagePreview && <img src={imagePreview} alt="" className="w-full h-full object-cover" />}
            {imageUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
            {!imagePreview && (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <ImagePlus className="w-7 h-7 mb-2" /><p className="text-sm">Click to upload</p>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
          </label>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
          <textarea rows={3} value={pollDescription} onChange={(e) => setPollDescription(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5] resize-none" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Categories</label>
          <p className="text-xs text-slate-400 mb-3">
            Renaming is safe — nominees stay attached. Categories that already have nominees can't be removed here (close the poll instead).
          </p>
          <div className="space-y-2">
            {categoryDrafts.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Category ${i + 1} name`}
                  value={c.name}
                  onChange={(e) => updateCategoryName(i, e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5]"
                />
                {categoryDrafts.length > 1 && (
                  <button onClick={() => removeCategoryDraft(i)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addCategory}
            disabled={categoryDrafts.length >= MAX_NOMINATION_CATEGORIES}
            className="flex items-center gap-1.5 text-sm font-medium text-[#6b2fa5] hover:bg-[#6b2fa5]/5 px-3 py-1.5 rounded-lg transition-colors mt-2 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Add Category
          </button>
        </div>

        {saveError && (
          <p className="text-xs text-red-600 flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {saveError}</p>
        )}
        {saveSuccess && (
          <p className="text-xs text-green-600 flex items-start gap-1.5"><CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> Saved</p>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || imageUploading}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#6b2fa5] hover:bg-[#5a1f8a] disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
          </button>
        </div>
      </div>

      {/* Nominees viewer */}
      <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
        <Users className="w-4 h-4 text-[#6b2fa5]" /> Nominees
      </h2>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
        {poll.categories.map((c) => (
          <button
            key={c.categoryId}
            onClick={() => setActiveCategoryId(c.categoryId)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors
              ${c.categoryId === activeCategoryId ? "bg-[#6b2fa5] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            <Tag className="w-3 h-3" /> {c.name}
          </button>
        ))}
      </div>

      {nomineesLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#6b2fa5]" /></div>
      ) : nominees.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-8">No nominees in this category yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {nominees.map((n) => (
            <div key={n.nomineeId} className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3">
              <img src={dicebearAvatarUrl(n.name)} alt="" className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate capitalize">{n.name}</p>
                <p className="text-xs text-slate-500">{n.count} nomination{n.count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
