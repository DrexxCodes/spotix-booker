"use client"

import type React from "react"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import { uploadImage } from "@/lib/image-uploader"
import {
  Calendar, Users, Plus, Trash2, AlertCircle, CheckCircle,
  Sparkles, Info, ImageIcon, Loader, ChevronRight, ChevronLeft,
  ToggleLeft, ToggleRight, Layers, FolderPlus, Tag,
  ChevronDown, ChevronUp, Hash,
} from "lucide-react"
import {
  MIN_VOTE_PRICE, MAX_VOTE_PRICE, ROYALTY_PERCENT,
  MAX_SINGLE_CONTESTANTS, MAX_GROUP_TOP_CATEGORIES,
  MAX_GROUP_TOTAL_SUBCATEGORIES, MAX_CONTESTANTS_PER_CATEGORY,
  GROUP_POLL_LIMITS_SUMMARY, SINGLE_POLL_LIMITS_SUMMARY,
  countSubcategories,
} from "@/lib/poll-config"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContestantForm {
  contestantId:  string
  name:          string
  imagePreview:  string | null
  imageUrl:      string | null
  uploading:     boolean
}

interface CategoryForm {
  categoryId:    string
  name:          string
  pollPrice:     number
  contestants:   ContestantForm[]
  subcategories: CategoryForm[]
  expanded:      boolean           // UI-only: accordion open/closed
}

interface PollForm {
  pollName:          string
  pollDescription:   string
  pollStartDate:     string
  pollStartTime:     string
  pollEndDate:       string
  pollEndTime:       string
  pollPrice:         number        // single polls only
  pollImagePreview:  string | null
  pollImageUrl:      string | null
  pollType:          "single" | "group"
  buyerBearsBurden:  boolean
  statsVisible:      boolean
}

// ─── ID generators ────────────────────────────────────────────────────────────

function genContestantId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let id = "sp-cont-"
  for (let i = 0; i < 10; i++) id += chars.charAt(Math.floor(Math.random() * chars.length))
  return id
}

function genCategoryId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let id = "sp-cat-"
  for (let i = 0; i < 10; i++) id += chars.charAt(Math.floor(Math.random() * chars.length))
  return id
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function doUpload(file: File, folder: string): Promise<string | null> {
  try {
    const { uploadPromise } = uploadImage(file, { cloudinaryFolder: folder })
    const result = await uploadPromise
    return result.url
  } catch { return null }
}

// ─── Empty factories ──────────────────────────────────────────────────────────

function emptyContestant(): ContestantForm {
  return { contestantId: "", name: "", imagePreview: null, imageUrl: null, uploading: false }
}

function emptyCategory(): CategoryForm {
  return {
    categoryId:    genCategoryId(),
    name:          "",
    pollPrice:     100,
    contestants:   [emptyContestant(), emptyContestant()],
    subcategories: [],
    expanded:      true,
  }
}

// ─── Step validators ──────────────────────────────────────────────────────────

function validateStep1(form: PollForm): string[] {
  const e: string[] = []
  if (!form.pollName.trim())        e.push("Poll name is required")
  if (!form.pollImageUrl)           e.push("Poll cover image is required")
  if (!form.pollDescription.trim()) e.push("Description is required")
  return e
}

function validateStep2(form: PollForm): string[] {
  const e: string[] = []
  if (!form.pollStartDate) e.push("Start date is required")
  if (!form.pollStartTime) e.push("Start time is required")
  if (!form.pollEndDate)   e.push("End date is required")
  if (!form.pollEndTime)   e.push("End time is required")
  if (form.pollType === "single") {
    if (form.pollPrice !== 0 && (form.pollPrice < MIN_VOTE_PRICE || form.pollPrice > MAX_VOTE_PRICE))
      e.push(`Price must be ₦0 (free) or between ₦${MIN_VOTE_PRICE} and ₦${MAX_VOTE_PRICE}`)
  }
  if (form.pollStartDate && form.pollStartTime && form.pollEndDate && form.pollEndTime) {
    const start = new Date(`${form.pollStartDate}T${form.pollStartTime}`)
    const end   = new Date(`${form.pollEndDate}T${form.pollEndTime}`)
    if (end <= start) e.push("End date/time must be after start date/time")
  }
  return e
}

function validateContestants(contestants: ContestantForm[], label: string): string[] {
  const e: string[] = []
  contestants.forEach((c, i) => {
    if (!c.name.trim())        e.push(`${label} Contestant ${i + 1}: name is required`)
    if (!c.imageUrl)           e.push(`${label} Contestant ${i + 1}: photo is required`)
    if (!c.contestantId)       e.push(`${label} Contestant ${i + 1}: generate an ID first`)
  })
  return e
}

function validateCategoryTree(cats: CategoryForm[], path: string): string[] {
  const e: string[] = []
  for (const [i, cat] of cats.entries()) {
    const label = `${path} > "${cat.name || `Category ${i + 1}`}"`
    if (!cat.name.trim()) { e.push(`${label}: name is required`); continue }
    if (cat.pollPrice !== 0 && (cat.pollPrice < MIN_VOTE_PRICE || cat.pollPrice > MAX_VOTE_PRICE))
      e.push(`${label}: price must be ₦0 (free) or ₦${MIN_VOTE_PRICE}–₦${MAX_VOTE_PRICE}`)

    const hasSubs = cat.subcategories.length > 0
    if (!hasSubs) {
      if (cat.contestants.length < 2) e.push(`${label}: needs at least 2 contestants`)
      if (cat.contestants.length > MAX_CONTESTANTS_PER_CATEGORY)
        e.push(`${label}: max ${MAX_CONTESTANTS_PER_CATEGORY} contestants`)
      e.push(...validateContestants(cat.contestants, label))
    } else {
      e.push(...validateCategoryTree(cat.subcategories, label))
    }
  }
  return e
}

function validateStep3(form: PollForm, contestants: ContestantForm[], categories: CategoryForm[]): string[] {
  if (form.pollType === "single") {
    const e: string[] = []
    if (contestants.length < 2) e.push("At least 2 contestants are required")
    if (contestants.length > MAX_SINGLE_CONTESTANTS) e.push(`Max ${MAX_SINGLE_CONTESTANTS} contestants allowed`)
    e.push(...validateContestants(contestants, ""))
    return e
  }
  // group
  const e: string[] = []
  if (categories.length === 0) e.push("Add at least 1 top-level category")
  if (categories.length > MAX_GROUP_TOP_CATEGORIES) e.push(`Max ${MAX_GROUP_TOP_CATEGORIES} top-level categories`)
  const totalSubs = countSubcategories(categories)
  if (totalSubs > MAX_GROUP_TOTAL_SUBCATEGORIES) e.push(`Total sub-categories cannot exceed ${MAX_GROUP_TOTAL_SUBCATEGORIES}`)
  e.push(...validateCategoryTree(categories, "Poll"))
  return e
}

// ─── Serialise category tree for API ─────────────────────────────────────────

function serializeCategory(cat: CategoryForm): object {
  return {
    categoryId:   cat.categoryId,
    name:         cat.name,
    pollPrice:    cat.pollPrice,
    contestants:  cat.subcategories.length === 0
      ? cat.contestants.map((c) => ({ contestantId: c.contestantId, name: c.name, image: c.imageUrl, votes: 0 }))
      : [],
    subcategories: cat.subcategories.map(serializeCategory),
  }
}

// ─── Contestant row ───────────────────────────────────────────────────────────

function ContestantRow({
  c, idx, onUpdate, onRemove, canRemove, uploadFolder,
}: {
  c:            ContestantForm
  idx:          number
  onUpdate:     (patch: Partial<ContestantForm>) => void
  onRemove:     () => void
  canRemove:    boolean
  uploadFolder: string
}) {
  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onUpdate({ imagePreview: URL.createObjectURL(file), imageUrl: null, uploading: true })
    const url = await doUpload(file, uploadFolder)
    if (url) onUpdate({ imageUrl: url, uploading: false })
    else onUpdate({ uploading: false })
  }

  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2.5 bg-white">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600">#{idx + 1}</p>
        {canRemove && (
          <button onClick={onRemove} className="p-1 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        )}
      </div>

      {/* Name */}
      <input type="text" placeholder="Contestant name" value={c.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20" />

      {/* ID */}
      <div className="flex gap-1.5">
        <input type="text" value={c.contestantId} readOnly placeholder="ID…"
          className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-[10px] bg-gray-50 text-gray-500 font-mono" />
        <button onClick={() => onUpdate({ contestantId: genContestantId() })}
          className="px-2 py-1.5 bg-[#6b2fa5] text-white rounded-lg text-[10px] font-semibold hover:bg-[#5a1f8a] transition-colors whitespace-nowrap">
          Gen ID
        </button>
      </div>

      {/* Photo */}
      <label htmlFor={`cont-img-${c.contestantId || idx}`}
        className={`flex items-center gap-2 border-2 border-dashed rounded-lg p-2 cursor-pointer transition-colors
          ${c.uploading ? "opacity-60 pointer-events-none" : "hover:border-[#6b2fa5]/40"}
          ${c.imageUrl ? "border-green-300 bg-green-50/30" : "border-gray-200"}`}>
        {c.imagePreview
          ? <img src={c.imagePreview} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
          : <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-4 h-4 text-gray-300" />
            </div>
        }
        <span className="text-xs text-gray-400">
          {c.uploading ? "Uploading…" : c.imageUrl ? "Photo uploaded ✓" : "Upload photo"}
        </span>
        {c.uploading && <Loader className="w-3 h-3 animate-spin text-[#6b2fa5] ml-auto" />}
      </label>
      <input id={`cont-img-${c.contestantId || idx}`} type="file" accept="image/*"
        className="hidden" onChange={handleImage} disabled={c.uploading} />
    </div>
  )
}

// ─── Category block (recursive) ───────────────────────────────────────────────

function CategoryBlock({
  cat, path, depth, totalTopCats, totalSubcats, onUpdate, onRemove, canRemove,
}: {
  cat:           CategoryForm
  path:          string
  depth:         number               // 0 = top-level
  totalTopCats:  number
  totalSubcats:  number
  onUpdate:      (updated: CategoryForm) => void
  onRemove:      () => void
  canRemove:     boolean
}) {
  const isLeaf    = cat.subcategories.length === 0
  const canAddSub = depth === 0
    ? totalSubcats < MAX_GROUP_TOTAL_SUBCATEGORIES   // top-level: limited by total subs
    : totalSubcats < MAX_GROUP_TOTAL_SUBCATEGORIES   // deeper: same global sub budget

  const updateContestant = (idx: number, patch: Partial<ContestantForm>) =>
    onUpdate({ ...cat, contestants: cat.contestants.map((c, i) => i === idx ? { ...c, ...patch } : c) })

  const addContestant = () => {
    if (cat.contestants.length >= MAX_CONTESTANTS_PER_CATEGORY) return
    onUpdate({ ...cat, contestants: [...cat.contestants, emptyContestant()] })
  }

  const removeContestant = (idx: number) =>
    onUpdate({ ...cat, contestants: cat.contestants.filter((_, i) => i !== idx) })

  const addSubcategory = () => {
    onUpdate({ ...cat, subcategories: [...cat.subcategories, emptyCategory()] })
  }

  const updateSubcategory = (idx: number, updated: CategoryForm) =>
    onUpdate({ ...cat, subcategories: cat.subcategories.map((s, i) => i === idx ? updated : s) })

  const removeSubcategory = (idx: number) =>
    onUpdate({ ...cat, subcategories: cat.subcategories.filter((_, i) => i !== idx) })

  const indentClass = depth === 0 ? "" : depth === 1 ? "ml-4" : "ml-8"
  const bgClass     = depth === 0 ? "bg-white" : depth === 1 ? "bg-purple-50/40" : "bg-blue-50/30"

  return (
    <div className={`${indentClass} border border-gray-200 rounded-xl overflow-hidden ${bgClass}`}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <button onClick={() => onUpdate({ ...cat, expanded: !cat.expanded })}
          className="p-0.5 hover:bg-gray-100 rounded transition-colors">
          {cat.expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </button>

        <div className="w-5 h-5 rounded-lg bg-[#6b2fa5]/10 flex items-center justify-center flex-shrink-0">
          <Tag className="w-3 h-3 text-[#6b2fa5]" />
        </div>

        <input type="text" placeholder={`Category name…`} value={cat.name}
          onChange={(e) => onUpdate({ ...cat, name: e.target.value })}
          className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#6b2fa5] focus:ring-1 focus:ring-[#6b2fa5]/20 min-w-0" />

        {/* Price */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
          <span className="px-1.5 text-xs text-gray-400 bg-gray-50">₦</span>
          <input type="number" min="0" step="50" value={cat.pollPrice}
            onChange={(e) => onUpdate({ ...cat, pollPrice: Number(e.target.value) })}
            className="w-16 px-1.5 py-1 text-xs border-none outline-none text-gray-700" />
        </div>

        {canRemove && (
          <button onClick={onRemove} className="p-1 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        )}
      </div>

      {/* Body */}
      {cat.expanded && (
        <div className="p-3 space-y-3">
          {/* Subcategories */}
          {cat.subcategories.map((sub, si) => (
            <CategoryBlock
              key={sub.categoryId}
              cat={sub}
              path={`${path} > ${cat.name || "?"}`}
              depth={depth + 1}
              totalTopCats={totalTopCats}
              totalSubcats={totalSubcats}
              onUpdate={(u) => updateSubcategory(si, u)}
              onRemove={() => removeSubcategory(si)}
              canRemove={cat.subcategories.length > 1}
            />
          ))}

          {/* Add sub-category button (only branch nodes or if converting to branch) */}
          {canAddSub && (
            <button onClick={addSubcategory}
              className="w-full py-1.5 border border-dashed border-[#6b2fa5]/30 text-[#6b2fa5] rounded-lg text-xs font-medium hover:bg-[#6b2fa5]/5 transition-colors flex items-center justify-center gap-1.5">
              <FolderPlus className="w-3.5 h-3.5" />
              Add sub-category
            </button>
          )}

          {/* Contestants — only for leaf nodes */}
          {isLeaf && (
            <>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Contestants ({cat.contestants.length}/{MAX_CONTESTANTS_PER_CATEGORY})
                </p>
                {cat.contestants.map((c, ci) => (
                  <ContestantRow
                    key={ci}
                    c={c}
                    idx={ci}
                    onUpdate={(patch) => updateContestant(ci, patch)}
                    onRemove={() => removeContestant(ci)}
                    canRemove={cat.contestants.length > 2}
                    uploadFolder="spotix/polls/contestants"
                  />
                ))}
              </div>
              {cat.contestants.length < MAX_CONTESTANTS_PER_CATEGORY && (
                <button onClick={addContestant}
                  className="w-full py-1.5 border border-dashed border-gray-200 text-gray-400 rounded-lg text-xs font-medium hover:border-[#6b2fa5]/40 hover:text-[#6b2fa5] transition-colors flex items-center justify-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add contestant
                </button>
              )}
            </>
          )}

          {/* Branch info */}
          {!isLeaf && (
            <p className="text-[10px] text-gray-400 italic px-1">
              This category has sub-categories. Add contestants inside those sub-categories.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatePollPage() {
  const router = useRouter()
  const [authReady,          setAuthReady]         = useState(false)
  const [currentStep,        setCurrentStep]       = useState(1)
  const [stepErrors,         setStepErrors]        = useState<string[]>([])
  const [submitting,         setSubmitting]        = useState(false)
  const [pollImageUploading, setPollImageUploading] = useState(false)

  const [form, setForm] = useState<PollForm>({
    pollName: "", pollDescription: "",
    pollStartDate: "", pollStartTime: "",
    pollEndDate: "", pollEndTime: "",
    pollPrice: 100,
    pollImagePreview: null, pollImageUrl: null,
    pollType:         "single",
    buyerBearsBurden: true,
    statsVisible:     true,
  })

  // Single-poll contestants
  const [contestants, setContestants] = useState<ContestantForm[]>([
    emptyContestant(), emptyContestant(),
  ])

  // Group-poll categories (Tier-1)
  const [categories, setCategories] = useState<CategoryForm[]>([emptyCategory()])

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      let token = getAccessToken()
      if (!token) { const r = await tryRefreshTokens(); if (!r) { router.push("/login"); return }; token = getAccessToken() }
      if (!token) { router.push("/login"); return }
      const res = await authFetch("/api/user/me")
      if (!res.ok) { router.push("/login"); return }
      setAuthReady(true)
    }
    init()
  }, [router])

  // ── Poll image upload ───────────────────────────────────────────────────────
  const handlePollImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setForm((prev) => ({ ...prev, pollImagePreview: URL.createObjectURL(file), pollImageUrl: null }))
    setPollImageUploading(true)
    const url = await doUpload(file, "spotix/polls/covers")
    if (url) setForm((prev) => ({ ...prev, pollImageUrl: url }))
    else setStepErrors(["Failed to upload poll image. Please try again."])
    setPollImageUploading(false)
  }

  // ── Single-poll contestant helpers ──────────────────────────────────────────
  const updateContestant = (idx: number, patch: Partial<ContestantForm>) =>
    setContestants((prev) => prev.map((c, i) => i === idx ? { ...c, ...patch } : c))

  const handleContestantImage = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    updateContestant(idx, { imagePreview: URL.createObjectURL(file), imageUrl: null, uploading: true })
    const url = await doUpload(file, "spotix/polls/contestants")
    if (url) updateContestant(idx, { imageUrl: url, uploading: false })
    else updateContestant(idx, { uploading: false })
  }

  // ── Step navigation ─────────────────────────────────────────────────────────
  const goToStep = (next: number) => {
    let errs: string[] = []
    if (currentStep === 1) errs = validateStep1(form)
    if (currentStep === 2) errs = validateStep2(form)
    setStepErrors(errs)
    if (errs.length === 0) setCurrentStep(next)
  }

  // ── Counts for group poll budget display ────────────────────────────────────
  const totalTopCats  = categories.length
  const totalSubcats  = countSubcategories(categories)

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validateStep3(form, contestants, categories)
    if (errs.length) { setStepErrors(errs); return }
    setSubmitting(true)
    setStepErrors([])

    try {
      const payload: Record<string, any> = {
        pollName:        form.pollName,
        pollImage:       form.pollImageUrl,
        pollDescription: form.pollDescription,
        pollStartDate:   form.pollStartDate,
        pollStartTime:   form.pollStartTime,
        pollEndDate:     form.pollEndDate,
        pollEndTime:     form.pollEndTime,
        pollType:        form.pollType,
        buyerBearsBurden: form.buyerBearsBurden,
        statsVisible:    form.statsVisible,
      }

      if (form.pollType === "single") {
        payload.pollPrice   = form.pollPrice
        payload.contestants = contestants.map((c) => ({
          contestantId: c.contestantId, name: c.name, image: c.imageUrl, votes: 0,
        }))
      } else {
        payload.categories = categories.map(serializeCategory)
      }

      const res  = await authFetch("/api/polls/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setStepErrors([data.error || "Failed to create poll"]); return }
      router.push("/polls")
    } catch {
      setStepErrors(["An unexpected error occurred. Please try again."])
    } finally {
      setSubmitting(false)
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-8 h-8 animate-spin text-[#6b2fa5]" />
      </div>
    )
  }

  const steps = [
    { n: 1, label: "Poll Info", icon: Info },
    { n: 2, label: "Schedule",  icon: Calendar },
    { n: 3, label: form.pollType === "single" ? "Contestants" : "Categories", icon: Users },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#6b2fa5] rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Poll</h1>
              <p className="text-sm text-gray-500">Set up a new voting campaign</p>
            </div>
          </div>

          {/* Step pills */}
          <div className="flex items-center gap-2">
            {steps.map((s, idx) => {
              const Icon   = s.icon
              const active = currentStep === s.n
              const done   = currentStep > s.n
              return (
                <div key={s.n} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex-1 justify-center
                    ${done ? "bg-green-50 text-green-700" : active ? "bg-[#6b2fa5]/10 text-[#6b2fa5]" : "bg-white text-gray-400 border border-gray-200"}`}>
                    {done ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    <span className="hidden sm:block">{s.label}</span>
                  </div>
                  {idx < steps.length - 1 && <div className={`w-4 h-px flex-shrink-0 ${done ? "bg-green-400" : "bg-gray-200"}`} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Errors */}
        {stepErrors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-800 mb-1">Please fix the following:</p>
              {stepErrors.map((e, i) => <p key={i} className="text-xs text-red-700">• {e}</p>)}
            </div>
          </div>
        )}

        {/* ── STEP 1: Poll Info ──────────────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-[#6b2fa5]" /> Basic Information
            </h2>

            {/* Poll type selector */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Poll Type *</label>
              <div className="grid grid-cols-2 gap-3">
                {(["single", "group"] as const).map((type) => (
                  <button key={type} onClick={() => setForm((p) => ({ ...p, pollType: type }))}
                    className={`flex items-center gap-2.5 p-3.5 rounded-xl border-2 text-left transition-all
                      ${form.pollType === type
                        ? "border-[#6b2fa5] bg-[#6b2fa5]/5"
                        : "border-gray-200 hover:border-gray-300"}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                      ${form.pollType === type ? "bg-[#6b2fa5] text-white" : "bg-gray-100 text-gray-400"}`}>
                      {type === "single" ? <Users className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${form.pollType === type ? "text-[#6b2fa5]" : "text-gray-700"}`}>
                        {type === "single" ? "Single Poll" : "Group Poll"}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {type === "single"
                          ? `Up to ${MAX_SINGLE_CONTESTANTS} contestants`
                          : `Nested categories · ${MAX_GROUP_TOP_CATEGORIES} top-level`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Poll name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Poll Name *</label>
              <input type="text" placeholder="e.g. Best Local Artist 2025"
                value={form.pollName} onChange={(e) => setForm({ ...form, pollName: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20" />
            </div>

            {/* Cover image */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Cover Image *{" "}
                {pollImageUploading && <Loader className="w-3 h-3 inline animate-spin text-[#6b2fa5] ml-1" />}
                {form.pollImageUrl && !pollImageUploading && <CheckCircle className="w-3 h-3 inline text-green-500 ml-1" />}
              </label>
              <label htmlFor="poll-cover"
                className={`block border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors
                  ${pollImageUploading ? "opacity-60 pointer-events-none" : "hover:border-[#6b2fa5]/40 hover:bg-[#6b2fa5]/5"}
                  ${form.pollImageUrl ? "border-green-300 bg-green-50/30" : "border-gray-200"}`}>
                {form.pollImagePreview
                  ? <div className="w-full aspect-video rounded-lg overflow-hidden">
                      <img src={form.pollImagePreview} alt="Cover" className="w-full h-full object-cover" />
                    </div>
                  : <div className="py-4">
                      <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Click to upload cover image</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG — max 5 MB</p>
                    </div>
                }
              </label>
              <input id="poll-cover" type="file" accept="image/*" className="hidden"
                onChange={handlePollImageChange} disabled={pollImageUploading} />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Description *</label>
              <textarea placeholder="Describe your poll…" value={form.pollDescription}
                onChange={(e) => setForm({ ...form, pollDescription: e.target.value })}
                rows={4} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20 resize-none" />
            </div>

            {/* Buyer-bears-burden toggle */}
            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-900">Service Fee Burden</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Spotix charges a {ROYALTY_PERCENT}% service fee on every vote.
                    Who should pay it?
                  </p>
                </div>
                <button onClick={() => setForm((p) => ({ ...p, buyerBearsBurden: !p.buyerBearsBurden }))}
                  className="flex-shrink-0">
                  {form.buyerBearsBurden
                    ? <ToggleRight className="w-8 h-8 text-[#6b2fa5]" />
                    : <ToggleLeft  className="w-8 h-8 text-gray-400"  />}
                </button>
              </div>
              <div className={`text-xs px-3 py-2 rounded-lg font-medium ${form.buyerBearsBurden ? "bg-[#6b2fa5]/10 text-[#6b2fa5]" : "bg-gray-100 text-gray-600"}`}>
                {form.buyerBearsBurden
                  ? `Voter pays: vote price + ${ROYALTY_PERCENT}% fee on top`
                  : `You pay: ${ROYALTY_PERCENT}% deducted from your payout`}
              </div>
              <p className="text-[10px] text-orange-600 font-medium">
                ⚠️ This setting cannot be changed after the poll is created.
              </p>
            </div>

            {/* Stats visibility toggle */}
            <div className="flex items-start justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div>
                <p className="text-xs font-semibold text-gray-800">Show Vote Stats to Voters</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  If off, voters cannot see live vote counts or standings.
                </p>
              </div>
              <button onClick={() => setForm((p) => ({ ...p, statsVisible: !p.statsVisible }))} className="flex-shrink-0">
                {form.statsVisible
                  ? <ToggleRight className="w-8 h-8 text-[#6b2fa5]" />
                  : <ToggleLeft  className="w-8 h-8 text-gray-400"  />}
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button onClick={() => goToStep(2)} disabled={pollImageUploading}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#6b2fa5] text-white rounded-lg text-sm font-medium hover:bg-[#5a1f8a] transition-colors disabled:opacity-50">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Schedule & Pricing ─────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#6b2fa5]" /> Schedule{form.pollType === "single" ? " & Pricing" : ""}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Start Date", type: "date", key: "pollStartDate" as const },
                { label: "Start Time", type: "time", key: "pollStartTime" as const },
                { label: "End Date",   type: "date", key: "pollEndDate"   as const, min: form.pollStartDate || undefined },
                { label: "End Time",   type: "time", key: "pollEndTime"   as const },
              ].map(({ label, type, key, min }: any) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">{label} *</label>
                  <input type={type} min={min} value={form[key as keyof PollForm] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20" />
                </div>
              ))}
            </div>

            {/* Price — only for single polls (group polls set price per category) */}
            {form.pollType === "single" && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Price Per Vote (₦) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                  <input type="number" min="0" step="50" value={form.pollPrice}
                    onChange={(e) => setForm({ ...form, pollPrice: Number(e.target.value) })}
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20" />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  ₦0 = free poll · ₦{MIN_VOTE_PRICE}–₦{MAX_VOTE_PRICE.toLocaleString()} for paid polls
                </p>
              </div>
            )}

            {form.pollType === "group" && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                For group polls, set the price per vote on each individual category in the next step.
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setStepErrors([]); setCurrentStep(1) }}
                className="flex items-center gap-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => goToStep(3)}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#6b2fa5] text-white rounded-lg text-sm font-medium hover:bg-[#5a1f8a] transition-colors">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Contestants / Categories ──────────────────────────── */}
        {currentStep === 3 && (
          <div className="space-y-4">

            {/* ── Single poll ───────────────────────────────────────────── */}
            {form.pollType === "single" && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#6b2fa5]" /> Contestants
                  </h2>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {contestants.length}/{MAX_SINGLE_CONTESTANTS}
                  </span>
                </div>

                <div className="space-y-4">
                  {contestants.map((c, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-700">Contestant {idx + 1}</p>
                        {contestants.length > 2 && (
                          <button onClick={() => setContestants((p) => p.filter((_, i) => i !== idx))}
                            className="p-1.5 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                        <input type="text" placeholder="Contestant name" value={c.name}
                          onChange={(e) => updateContestant(idx, { name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#6b2fa5]" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">ID *</label>
                        <div className="flex gap-2">
                          <input type="text" value={c.contestantId} disabled placeholder="Click Generate →"
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-600 font-mono" />
                          <button onClick={() => updateContestant(idx, { contestantId: genContestantId() })}
                            className="px-3 py-2 bg-[#6b2fa5] text-white rounded-lg text-xs font-medium hover:bg-[#5a1f8a]">
                            Generate
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Photo *{" "}
                          {c.uploading && <Loader className="w-3 h-3 inline animate-spin text-[#6b2fa5] ml-1" />}
                          {c.imageUrl && !c.uploading && <CheckCircle className="w-3 h-3 inline text-green-500 ml-1" />}
                        </label>
                        <label htmlFor={`cont-img-${idx}`}
                          className={`block border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors
                            ${c.uploading ? "opacity-60 pointer-events-none" : "hover:border-[#6b2fa5]/40"}
                            ${c.imageUrl ? "border-green-300 bg-green-50/30" : "border-gray-200"}`}>
                          {c.imagePreview
                            ? <img src={c.imagePreview} alt="" className="w-16 h-16 mx-auto rounded-lg object-cover" />
                            : <div className="py-2"><ImageIcon className="w-5 h-5 text-gray-300 mx-auto mb-1" /><p className="text-xs text-gray-400">Upload photo</p></div>
                          }
                        </label>
                        <input id={`cont-img-${idx}`} type="file" accept="image/*" className="hidden"
                          onChange={(e) => handleContestantImage(idx, e)} disabled={c.uploading} />
                      </div>
                    </div>
                  ))}

                  {contestants.length < MAX_SINGLE_CONTESTANTS && (
                    <button onClick={() => setContestants((p) => [...p, emptyContestant()])}
                      className="w-full py-2.5 border-2 border-dashed border-gray-200 text-gray-400 rounded-xl text-sm font-medium hover:border-[#6b2fa5]/40 hover:text-[#6b2fa5] flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Add Contestant
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Group poll ─────────────────────────────────────────────── */}
            {form.pollType === "group" && (
              <div className="space-y-3">
                {/* Budget bar */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-[#6b2fa5]" /> Award Categories
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 bg-[#6b2fa5]/5 rounded-lg">
                      <p className="text-xs text-gray-500">Top-level</p>
                      <p className={`text-lg font-bold ${totalTopCats > MAX_GROUP_TOP_CATEGORIES ? "text-red-600" : "text-[#6b2fa5]"}`}>
                        {totalTopCats}/{MAX_GROUP_TOP_CATEGORIES}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-[#6b2fa5]/5 rounded-lg">
                      <p className="text-xs text-gray-500">Sub-categories</p>
                      <p className={`text-lg font-bold ${totalSubcats > MAX_GROUP_TOTAL_SUBCATEGORIES ? "text-red-600" : "text-[#6b2fa5]"}`}>
                        {totalSubcats}/{MAX_GROUP_TOTAL_SUBCATEGORIES}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 text-center">
                    Each category (at any level) holds up to {MAX_CONTESTANTS_PER_CATEGORY} contestants.
                  </p>
                </div>

                {/* Category tree */}
                <div className="space-y-3">
                  {categories.map((cat, ci) => (
                    <CategoryBlock
                      key={cat.categoryId}
                      cat={cat}
                      path="Poll"
                      depth={0}
                      totalTopCats={totalTopCats}
                      totalSubcats={totalSubcats}
                      onUpdate={(u) => setCategories((prev) => prev.map((c, i) => i === ci ? u : c))}
                      onRemove={() => setCategories((prev) => prev.filter((_, i) => i !== ci))}
                      canRemove={categories.length > 1}
                    />
                  ))}
                </div>

                {categories.length < MAX_GROUP_TOP_CATEGORIES && (
                  <button onClick={() => setCategories((p) => [...p, emptyCategory()])}
                    className="w-full py-3 border-2 border-dashed border-[#6b2fa5]/30 text-[#6b2fa5] rounded-xl text-sm font-medium hover:bg-[#6b2fa5]/5 transition-colors flex items-center justify-center gap-2">
                    <FolderPlus className="w-4 h-4" /> Add Top-Level Category
                  </button>
                )}
              </div>
            )}

            {/* Nav */}
            <div className="flex gap-3">
              <button onClick={() => { setStepErrors([]); setCurrentStep(2) }}
                className="flex items-center gap-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handleSubmit}
                disabled={submitting || (form.pollType === "single" && contestants.some((c) => c.uploading))}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#6b2fa5] text-white rounded-lg text-sm font-medium hover:bg-[#5a1f8a] disabled:opacity-60">
                {submitting ? <><Loader className="w-4 h-4 animate-spin" /> Creating…</> : <><Sparkles className="w-4 h-4" /> Create Poll</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
