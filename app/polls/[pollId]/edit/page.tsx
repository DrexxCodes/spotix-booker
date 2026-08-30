"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import { dicebearAvatarUrl } from "@/lib/dicebear"
import {
  Loader, Loader2, ArrowLeft, Save, AlertCircle, CheckCircle, ImageIcon,
  Info, Calendar, Users, Plus, Trash2, ChevronRight, ChevronLeft,
  Layers, FolderPlus, Tag, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Download, User, ImagePlus, Wand2, UserCog, BarChart3, Crown, ShieldCheck, FileJson,
} from "lucide-react"
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning"
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog"
import type { CategoryForm as CreateCategoryForm } from "../../create/lib/factories"
import {
  MIN_VOTE_PRICE, MAX_VOTE_PRICE,
  resolvePollLimits, type ResolvedPollLimits,
  countSubcategories,
} from "@/lib/poll-config"
// Reuse the exact same ID-generation, upload, and dialog logic used in poll
// creation so editing behaves identically (per babe's request).
import {
  genContestantId, genCategoryId, doUpload,
  type ContestantForm as CreateContestantForm,
} from "../../create/lib/factories"
import { ImageChoiceDialog } from "../../create/components/ImageChoiceDialog"
import { ImportNomineesDialog } from "../../create/components/ImportNomineesDialog"
import { ImportNomineesCategoryDialog } from "../../create/components/ImportNomineesCategoryDialog"
import { FillWithJsonDialog } from "../../create/components/FillWithJsonDialog"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContestantForm {
  contestantId: string
  name:         string
  imagePreview: string | null
  imageUrl:     string | null
  imageType:    "uploaded" | "generated" | null
  uploading:    boolean
  isExisting:   boolean
  hasVotes:     boolean   // from DB — cannot be deleted if true
}

interface CategoryForm {
  categoryId:    string
  name:          string
  pollPrice:     number
  contestants:   ContestantForm[]
  subcategories: CategoryForm[]
  expanded:      boolean
  isExisting:    boolean
  hasVotes:      boolean  // true if any contestant in this category (recursively) has votes
}

interface PollMeta {
  pollName:          string
  pollDescription:   string
  pollStartDate:     string
  pollStartTime:     string
  pollEndDate:       string
  pollEndTime:       string
  pollPrice:         number
  pollImagePreview:  string | null
  pollImageUrl:      string | null
  pollImageUploading: boolean
  pollType:          "single" | "group"
  statsVisible:      boolean
}

/** Read-only vote-stats snapshot, captured once from the raw poll payload
 *  at load time — kept separate from the editable form state above so it
 *  never gets serialized back to the server on save. This is what a poll
 *  team member's "view vote stats" access resolves to on the Edit page,
 *  since team members never reach the main poll page's Overview tab. */
interface VoteStatsSnapshot {
  totalVotes: number
  totalRevenue: number
  standings: { name: string; votes: number; path?: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively check if any contestant in the category tree has votes */
function categoryHasVotes(cat: any): boolean {
  if ((cat.contestants ?? []).some((c: any) => (c.votes ?? 0) > 0)) return true
  return (cat.subcategories ?? []).some((s: any) => categoryHasVotes(s))
}

/** Hydrate a DB category tree into CategoryForm tree */
function hydrateCategories(cats: any[]): CategoryForm[] {
  return (cats ?? []).map((cat: any) => ({
    categoryId:    cat.categoryId ?? genCategoryId(),
    name:          cat.name ?? "",
    pollPrice:     cat.pollPrice ?? 100,
    contestants:   (cat.contestants ?? []).map((c: any) => ({
      contestantId: c.contestantId ?? "",
      name:         c.name ?? "",
      imagePreview: c.image ?? null,
      imageUrl:     c.image ?? null,
      imageType:    null,
      uploading:    false,
      isExisting:   true,
      hasVotes:     (c.votes ?? 0) > 0,
    })),
    subcategories: hydrateCategories(cat.subcategories ?? []),
    expanded:      false,
    isExisting:    true,
    hasVotes:      categoryHasVotes(cat),
  }))
}

/** Serialize a CategoryForm tree for the API */
function serializeCategory(cat: CategoryForm): object {
  return {
    categoryId:    cat.categoryId,
    name:          cat.name,
    pollPrice:     cat.pollPrice,
    contestants:   cat.subcategories.length === 0
      ? cat.contestants.map((c) => ({
          contestantId: c.contestantId, name: c.name, image: c.imageUrl,
          imageType: c.imageType ?? "uploaded",
          imageSeed: c.imageType === "generated" ? c.contestantId : null,
        }))
      : [],
    subcategories: cat.subcategories.map(serializeCategory),
  }
}

function emptyContestant(): ContestantForm {
  return { contestantId: "", name: "", imagePreview: null, imageUrl: null, imageType: null, uploading: false, isExisting: false, hasVotes: false }
}

/** Map a contestant imported from a nomination poll (create-shaped) into this page's ContestantForm */
function fromImportedContestant(c: CreateContestantForm): ContestantForm {
  return {
    contestantId: c.contestantId,
    name:         c.name,
    imagePreview: c.imagePreview,
    imageUrl:     c.imageUrl,
    imageType:    "generated",
    uploading:    false,
    isExisting:   false,
    hasVotes:     false,
  }
}

/** Map a category tree imported from a nomination poll (create-shaped) into this page's CategoryForm */
function fromImportedCategory(cat: CreateCategoryForm): CategoryForm {
  return {
    categoryId: cat.categoryId,
    name: cat.name,
    pollPrice: cat.pollPrice,
    contestants: cat.contestants.map(fromImportedContestant),
    subcategories: cat.subcategories.map(fromImportedCategory),
    expanded: true,
    isExisting: false,
    hasVotes: false,
  }
}

function emptyCategory(): CategoryForm {
  return {
    categoryId: genCategoryId(), name: "", pollPrice: 100,
    contestants: [emptyContestant(), emptyContestant()],
    subcategories: [], expanded: true, isExisting: false, hasVotes: false,
  }
}

/** Flattens a raw (un-hydrated) category tree from the API into a list of
 *  leaf-contestant standings for the read-only Vote Stats panel. */
function flattenCategoryStandings(cats: any[], path: string): { name: string; votes: number; path?: string }[] {
  const out: { name: string; votes: number; path?: string }[] = []
  for (const cat of cats ?? []) {
    const label = path ? `${path} › ${cat.name}` : cat.name
    if ((cat.subcategories ?? []).length > 0) {
      out.push(...flattenCategoryStandings(cat.subcategories, label))
    } else {
      for (const c of cat.contestants ?? []) {
        out.push({ name: c.name, votes: c.votes ?? 0, path: label })
      }
    }
  }
  return out
}

/** Builds the read-only vote-stats snapshot from the raw poll payload
 *  returned by /api/polls/one — computed once at load time, independent
 *  of the editable form state. */
function computeVoteStats(poll: any): VoteStatsSnapshot {
  if ((poll.pollType ?? "single") === "single") {
    const standings = (poll.contestants ?? []).map((c: any) => ({ name: c.name, votes: c.votes ?? 0 }))
    const totalVotes = standings.reduce((s: number, c: any) => s + c.votes, 0)
    return { totalVotes, totalRevenue: poll.pollAmount ?? 0, standings }
  }
  const standings = flattenCategoryStandings(poll.categories ?? [], "")
  const totalVotes = standings.reduce((s, c) => s + c.votes, 0)
  return { totalVotes, totalRevenue: poll.pollAmount ?? 0, standings }
}

// ─── Validators ───────────────────────────────────────────────────────────────

function validateStep1(meta: PollMeta): string[] {
  const e: string[] = []
  if (!meta.pollName.trim())        e.push("Poll name is required")
  if (!meta.pollImageUrl)           e.push("Poll cover image is required")
  if (!meta.pollDescription.trim()) e.push("Description is required")
  return e
}

function validateStep2(meta: PollMeta): string[] {
  const e: string[] = []
  if (!meta.pollStartDate) e.push("Start date is required")
  if (!meta.pollStartTime) e.push("Start time is required")
  if (!meta.pollEndDate)   e.push("End date is required")
  if (!meta.pollEndTime)   e.push("End time is required")
  if (meta.pollType === "single") {
    if (meta.pollPrice !== 0 && (meta.pollPrice < MIN_VOTE_PRICE || meta.pollPrice > MAX_VOTE_PRICE))
      e.push(`Price must be ₦0 (free) or ₦${MIN_VOTE_PRICE}–₦${MAX_VOTE_PRICE}`)
  }
  if (meta.pollStartDate && meta.pollStartTime && meta.pollEndDate && meta.pollEndTime) {
    const start = new Date(`${meta.pollStartDate}T${meta.pollStartTime}`)
    const end   = new Date(`${meta.pollEndDate}T${meta.pollEndTime}`)
    if (end <= start) e.push("End date/time must be after start date/time")
  }
  return e
}

function validateCategoryTree(cats: CategoryForm[], path: string, limits: ResolvedPollLimits): string[] {
  const e: string[] = []
  for (const [i, cat] of cats.entries()) {
    const label = `${path} › "${cat.name || `Category ${i + 1}`}"`
    if (!cat.name.trim()) { e.push(`${label}: name is required`); continue }
    if (cat.pollPrice !== 0 && (cat.pollPrice < MIN_VOTE_PRICE || cat.pollPrice > MAX_VOTE_PRICE))
      e.push(`${label}: price must be ₦0 or ₦${MIN_VOTE_PRICE}–₦${MAX_VOTE_PRICE}`)
    const isLeaf = cat.subcategories.length === 0
    if (isLeaf) {
      if (cat.contestants.length < 2) e.push(`${label}: needs at least 2 contestants`)
      if (cat.contestants.length > limits.maxContestantsPerCategory) e.push(`${label}: max ${limits.maxContestantsPerCategory} contestants`)
      cat.contestants.forEach((c, ci) => {
        if (!c.name.trim())  e.push(`${label} › Contestant ${ci + 1}: name required`)
        if (!c.imageUrl)     e.push(`${label} › Contestant ${ci + 1}: photo required`)
        if (!c.contestantId) e.push(`${label} › Contestant ${ci + 1}: generate an ID`)
      })
    } else {
      e.push(...validateCategoryTree(cat.subcategories, label, limits))
    }
  }
  return e
}

function validateStep3(meta: PollMeta, contestants: ContestantForm[], categories: CategoryForm[], limits: ResolvedPollLimits): string[] {
  if (meta.pollType === "single") {
    const e: string[] = []
    if (contestants.length < 2) e.push("At least 2 contestants are required")
    if (contestants.length > limits.maxSingleContestants) e.push(`Max ${limits.maxSingleContestants} contestants`)
    contestants.forEach((c, i) => {
      if (!c.name.trim())  e.push(`Contestant ${i + 1}: name required`)
      if (!c.imageUrl)     e.push(`Contestant ${i + 1}: photo required`)
      if (!c.contestantId) e.push(`Contestant ${i + 1}: ID required`)
    })
    return e
  }
  const e: string[] = []
  if (categories.length === 0) e.push("Add at least 1 top-level category")
  if (categories.length > limits.maxGroupTopCategories) e.push(`Max ${limits.maxGroupTopCategories} top-level categories`)
  const totalSubs = countSubcategories(categories)
  if (totalSubs > limits.maxGroupTotalSubcategories) e.push(`Total sub-categories cannot exceed ${limits.maxGroupTotalSubcategories}`)
  e.push(...validateCategoryTree(categories, "Poll", limits))
  return e
}

// ─── Contestant row ───────────────────────────────────────────────────────────

function ContestantRow({
  c, idx, onUpdate, onRemove, canRemove,
}: {
  c: ContestantForm; idx: number
  onUpdate: (p: Partial<ContestantForm>) => void
  onRemove: () => void; canRemove: boolean
}) {
  const [showChoice, setShowChoice] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Same ID-generation rule as poll creation: a new contestant's ID is
  // silently assigned the first time a photo is uploaded or generated —
  // there's no manual "Generate ID" step. Existing contestants keep their
  // locked, already-persisted ID.
  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const preview = URL.createObjectURL(file)
    const withId = c.contestantId || genContestantId()
    onUpdate({ contestantId: withId, imagePreview: preview, imageType: "uploaded", uploading: true })
    const url = await doUpload(file, "spotix/polls/contestants")
    onUpdate({ contestantId: withId, imagePreview: preview, imageUrl: url, imageType: "uploaded", uploading: false })
  }

  const handleGenerate = () => {
    const withId = c.contestantId || genContestantId()
    const url = dicebearAvatarUrl(withId)
    onUpdate({ contestantId: withId, imagePreview: url, imageUrl: url, imageType: "generated", uploading: false })
    setShowChoice(false)
  }

  const handleUploadChoice = () => {
    setShowChoice(false)
    // Defer so the dialog unmounts before the native file picker opens
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  return (
    <div className={`border rounded-xl p-3 space-y-2.5 ${c.isExisting ? "border-gray-200 bg-white" : "border-[#6b2fa5]/20 bg-[#6b2fa5]/3"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-gray-600">#{idx + 1}</p>
          {!c.isExisting && <span className="text-[10px] bg-[#6b2fa5]/10 text-[#6b2fa5] px-1.5 py-0.5 rounded-full font-semibold">New</span>}
          {c.isExisting && <span className="text-[10px] bg-gray-50 text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded-full font-medium">ID locked</span>}
          {c.hasVotes && <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold">Has votes</span>}
        </div>
        {canRemove && !c.hasVotes && (
          <button onClick={onRemove} className="p-1 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowChoice(true)}
          className="relative w-12 h-12 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden group"
        >
          {c.imagePreview ? (
            <img src={c.imagePreview} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <User className="w-5 h-5" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            {c.uploading
              ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              : c.imageType === "generated"
              ? <Wand2 className="w-3.5 h-3.5 text-white" />
              : <ImagePlus className="w-3.5 h-3.5 text-white" />}
          </div>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <input type="text" placeholder="Name" value={c.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#6b2fa5]" />
      </div>

      {showChoice && (
        <ImageChoiceDialog
          onUpload={handleUploadChoice}
          onGenerate={handleGenerate}
          onClose={() => setShowChoice(false)}
        />
      )}
    </div>
  )
}

// ─── Category block (recursive) ───────────────────────────────────────────────

function CategoryBlock({
  cat, path, depth, totalSubcats, limits, onUpdate, onRemove, canRemove, onOpenImport, onOpenImportCategories,
}: {
  cat: CategoryForm; path: string; depth: number
  totalSubcats: number
  limits: ResolvedPollLimits
  onUpdate: (u: CategoryForm) => void
  onRemove: () => void; canRemove: boolean
  onOpenImport: (targetCategoryId: string) => void
  /** Opens the whole-category importer targeting this category's
   *  subcategories slot, so imported nomination categories land as nested
   *  categories right here. */
  onOpenImportCategories: (targetCategoryId: string) => void
}) {
  const isLeaf   = cat.subcategories.length === 0
  const canAddSub = totalSubcats < limits.maxGroupTotalSubcategories
  const bgClass   = depth === 0 ? "bg-white" : depth === 1 ? "bg-purple-50/40" : "bg-blue-50/30"

  const updCont = (i: number, p: Partial<ContestantForm>) =>
    onUpdate({ ...cat, contestants: cat.contestants.map((c, ci) => ci === i ? { ...c, ...p } : c) })
  const rmCont  = (i: number) => onUpdate({ ...cat, contestants: cat.contestants.filter((_, ci) => ci !== i) })
  const addCont = () => { if (cat.contestants.length < limits.maxContestantsPerCategory) onUpdate({ ...cat, contestants: [...cat.contestants, emptyContestant()] }) }
  const addSub  = () => onUpdate({ ...cat, subcategories: [...cat.subcategories, emptyCategory()] })
  const updSub  = (i: number, u: CategoryForm) => onUpdate({ ...cat, subcategories: cat.subcategories.map((s, si) => si === i ? u : s) })
  const rmSub   = (i: number) => onUpdate({ ...cat, subcategories: cat.subcategories.filter((_, si) => si !== i) })

  return (
    <div className={`${depth > 0 ? "ml-4" : ""} border border-gray-200 rounded-xl overflow-hidden ${bgClass}`}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <button onClick={() => onUpdate({ ...cat, expanded: !cat.expanded })}
          className="p-0.5 hover:bg-gray-100 rounded">
          {cat.expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </button>
        <div className="w-5 h-5 rounded-lg bg-[#6b2fa5]/10 flex items-center justify-center flex-shrink-0">
          <Tag className="w-3 h-3 text-[#6b2fa5]" />
        </div>
        <input type="text" placeholder="Category name…" value={cat.name}
          onChange={(e) => onUpdate({ ...cat, name: e.target.value })}
          className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#6b2fa5] min-w-0" />
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
          <span className="px-1.5 text-xs text-gray-400 bg-gray-50">₦</span>
          <input type="number" min="0" step="50" value={cat.pollPrice}
            onChange={(e) => onUpdate({ ...cat, pollPrice: Number(e.target.value) })}
            className="w-16 px-1.5 py-1 text-xs border-none outline-none text-gray-700" />
        </div>
        {cat.hasVotes && <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">Has votes</span>}
        {canRemove && !cat.hasVotes && (
          <button onClick={onRemove} className="p-1 hover:bg-red-50 rounded-lg flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        )}
      </div>

      {cat.expanded && (
        <div className="p-3 space-y-3">
          {/* Sub-categories */}
          {cat.subcategories.map((sub, si) => (
            <CategoryBlock key={sub.categoryId} cat={sub} path={`${path} › ${cat.name || "?"}`}
              depth={depth + 1} totalSubcats={totalSubcats} limits={limits}
              onUpdate={(u) => updSub(si, u)}
              onRemove={() => rmSub(si)}
              canRemove={!sub.hasVotes && cat.subcategories.length > 1}
              onOpenImport={onOpenImport}
              onOpenImportCategories={onOpenImportCategories} />
          ))}

          {/* Add sub-category / import categories */}
          {canAddSub && (
            <div className="flex flex-wrap gap-2">
              <button onClick={addSub}
                className="flex-1 py-1.5 border border-dashed border-[#6b2fa5]/30 text-[#6b2fa5] rounded-lg text-xs font-medium hover:bg-[#6b2fa5]/5 flex items-center justify-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5" /> Add sub-category
              </button>
              <button onClick={() => onOpenImportCategories(cat.categoryId)}
                className="flex-1 py-1.5 border border-dashed border-gray-300 text-gray-500 rounded-lg text-xs font-medium hover:border-[#6b2fa5]/40 hover:text-[#6b2fa5] flex items-center justify-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Import categories
              </button>
            </div>
          )}

          {/* Contestants — only for leaf nodes */}
          {isLeaf && (
            <>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Contestants ({cat.contestants.length}/{limits.maxContestantsPerCategory})
                </p>
                {cat.contestants.map((c, ci) => (
                  <ContestantRow key={ci} c={c} idx={ci}
                    onUpdate={(p) => updCont(ci, p)}
                    onRemove={() => rmCont(ci)}
                    canRemove={cat.contestants.length > 2} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {cat.contestants.length < limits.maxContestantsPerCategory && (
                  <button onClick={addCont}
                    className="flex-1 py-1.5 border border-dashed border-gray-200 text-gray-400 rounded-lg text-xs font-medium hover:border-[#6b2fa5]/40 hover:text-[#6b2fa5] flex items-center justify-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add contestant
                  </button>
                )}
                <button onClick={() => onOpenImport(cat.categoryId)}
                  className="flex-1 py-1.5 border border-dashed border-gray-300 text-gray-500 rounded-lg text-xs font-medium hover:border-[#6b2fa5]/40 hover:text-[#6b2fa5] flex items-center justify-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Import from Nominees
                </button>
              </div>
            </>
          )}
          {!isLeaf && <p className="text-[10px] text-gray-400 italic px-1">Add contestants inside the sub-categories below.</p>}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Vote Stats panel (read-only) ──────────────────────────────────────────────
// Gives a poll team member "view vote stats" access right on the Edit page,
// since their access is scoped to this page only — they never reach the
// main poll page's Overview/Entries tabs.
function VoteStatsPanel({ stats }: { stats: VoteStatsSnapshot }) {
  const [open, setOpen] = useState(false)
  const sorted = [...stats.standings].sort((a, b) => b.votes - a.votes).slice(0, 8)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#6b2fa5]" />
          <span className="text-sm font-semibold text-gray-900">Vote Stats</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{stats.totalVotes.toLocaleString()} votes · ₦{stats.totalRevenue.toLocaleString()}</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4 space-y-2">
          {sorted.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">No votes yet</p>
          ) : (
            sorted.map((s, i) => {
              const pct = stats.totalVotes > 0 ? Math.round((s.votes / stats.totalVotes) * 100) : 0
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-4 text-[10px] font-bold text-gray-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-medium text-gray-800 truncate">{s.name}{s.path ? <span className="text-gray-400"> · {s.path}</span> : ""}</p>
                      <p className="text-xs font-bold text-gray-900 flex-shrink-0 ml-2">{s.votes.toLocaleString()}</p>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#6b2fa5] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default function EditPollPage() {
  const router = useRouter()
  const params = useParams()
  const pollId = params.pollId as string

  const [loadingPoll, setLoadingPoll] = useState(true)
  const [loadError,   setLoadError]   = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [stepErrors,  setStepErrors]  = useState<string[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [access,      setAccess]      = useState<"owner" | "member" | null>(null)
  const [voteStats,   setVoteStats]   = useState<VoteStatsSnapshot | null>(null)

  const [meta, setMeta] = useState<PollMeta>({
    pollName: "", pollDescription: "",
    pollStartDate: "", pollStartTime: "",
    pollEndDate: "", pollEndTime: "",
    pollPrice: 100,
    pollImagePreview: null, pollImageUrl: null, pollImageUploading: false,
    pollType: "single", statsVisible: true,
  })

  const [contestants, setContestants] = useState<ContestantForm[]>([])
  const [categories,  setCategories]  = useState<CategoryForm[]>([])
  // Admin-configurable structure limits for THIS poll (see
  // lib/poll-config.ts resolvePollLimits) — starts as the platform
  // defaults and is replaced with the poll's real resolved limits once
  // /api/polls/one responds below, so validation and the on-screen
  // counters (e.g. "12/50 contestants") always reflect what an admin has
  // actually configured for this poll, not the hardcoded defaults.
  const [limits, setLimits] = useState<ResolvedPollLimits>(resolvePollLimits(null))

  // Snapshot taken right after the poll finishes loading — compared against
  // current meta/contestants/categories to know if there's anything to lose.
  // See item 8 of the UI renovation ("same goes for editing polls").
  const initialSnapshotRef = useRef<string | null>(null)
  const isDirty = initialSnapshotRef.current !== null &&
    JSON.stringify({ meta, contestants, categories }) !== initialSnapshotRef.current
  const { showConfirmDialog, confirmLeave, cancelLeave, guardNavigation } = useUnsavedChangesWarning(isDirty)

  // ── Load poll ───────────────────────────────────────────────────────────────
  // Uses /api/polls/one (not /api/polls/list) because this page must be
  // reachable by both the poll creator AND an active poll team member —
  // /api/polls/list only ever returns polls the caller owns (it powers the
  // "My Polls" dashboard), while /api/polls/one resolves owner-or-member
  // access via app/lib/poll-team-access.ts. A team member lands here via
  // the link in their invite email, not through their own dashboard.
  useEffect(() => {
    const init = async () => {
      let token = getAccessToken()
      if (!token) { const r = await tryRefreshTokens(); if (!r) { router.push("/login"); return }; token = getAccessToken() }
      if (!token) { router.push("/login"); return }

      const res = await authFetch(`/api/polls/one?pollId=${encodeURIComponent(pollId)}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setLoadError(d.error ?? "You don't have access to this poll.")
        setLoadingPoll(false)
        return
      }
      const data = await res.json()
      const poll = data.poll
      if (!poll) { router.push("/polls"); return }

      setAccess(data.access ?? "owner")
      setVoteStats(computeVoteStats(poll))
      if (poll.limits) setLimits(poll.limits)

      setMeta({
        pollName:          poll.pollName        ?? "",
        pollDescription:   poll.pollDescription ?? "",
        pollStartDate:     poll.pollStartDate   ?? "",
        pollStartTime:     poll.pollStartTime   ?? "",
        pollEndDate:       poll.pollEndDate     ?? "",
        pollEndTime:       poll.pollEndTime     ?? "",
        pollPrice:         poll.pollPrice       ?? 100,
        pollImagePreview:  poll.pollImage       ?? null,
        pollImageUrl:      poll.pollImage       ?? null,
        pollImageUploading: false,
        pollType:          poll.pollType        ?? "single",
        statsVisible:      poll.statsVisible    ?? true,
      })

      if ((poll.pollType ?? "single") === "single") {
        setContestants((poll.contestants ?? []).map((c: any) => ({
          contestantId: c.contestantId ?? "",
          name:         c.name         ?? "",
          imagePreview: c.image        ?? null,
          imageUrl:     c.image        ?? null,
          imageType:    null,
          uploading:    false,
          isExisting:   true,
          hasVotes:     (c.votes ?? 0) > 0,
        })))
      } else {
        setCategories(hydrateCategories(poll.categories ?? []))
      }

      setLoadingPoll(false)
      // Snapshot for the unsaved-changes check above — taken after this
      // synchronous batch of setState calls has been queued, so it reflects
      // the freshly-loaded poll, not the empty initial state.
      queueMicrotask(() => {
        initialSnapshotRef.current = JSON.stringify({
          meta: {
            pollName: poll.pollName ?? "", pollDescription: poll.pollDescription ?? "",
            pollStartDate: poll.pollStartDate ?? "", pollStartTime: poll.pollStartTime ?? "",
            pollEndDate: poll.pollEndDate ?? "", pollEndTime: poll.pollEndTime ?? "",
            pollPrice: poll.pollPrice ?? 100,
            pollImagePreview: poll.pollImage ?? null, pollImageUrl: poll.pollImage ?? null,
            pollImageUploading: false,
            pollType: poll.pollType ?? "single", statsVisible: poll.statsVisible ?? true,
          },
          contestants: (poll.pollType ?? "single") === "single"
            ? (poll.contestants ?? []).map((c: any) => ({
                contestantId: c.contestantId ?? "", name: c.name ?? "",
                imagePreview: c.image ?? null, imageUrl: c.image ?? null,
                imageType: null, uploading: false, isExisting: true,
                hasVotes: (c.votes ?? 0) > 0,
              }))
            : [],
          categories: (poll.pollType ?? "single") === "single" ? [] : hydrateCategories(poll.categories ?? []),
        })
      })
    }
    init()
  }, [pollId, router])

  // ── Poll image ──────────────────────────────────────────────────────────────
  const handlePollImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setMeta((p) => ({ ...p, pollImagePreview: URL.createObjectURL(file), pollImageUrl: null, pollImageUploading: true }))
    const url = await doUpload(file, "spotix/polls/covers")
    if (url) setMeta((p) => ({ ...p, pollImageUrl: url, pollImageUploading: false }))
    else { setStepErrors(["Failed to upload image"]); setMeta((p) => ({ ...p, pollImageUploading: false })) }
  }

  // ── Single-poll contestant helpers ──────────────────────────────────────────
  const updCont = (i: number, p: Partial<ContestantForm>) =>
    setContestants((prev) => prev.map((c, ci) => ci === i ? { ...c, ...p } : c))

  // ── Import from Nominees ────────────────────────────────────────────────────
  // "root" targets the flat single-poll contestants list; any other value is
  // the categoryId of the group-poll leaf category requesting the import.
  const [importTarget, setImportTarget] = useState<string | null>(null)

  const injectImported = (cats: CategoryForm[], targetId: string, imported: ContestantForm[]): CategoryForm[] =>
    cats.map((cat) => {
      if (cat.categoryId === targetId) return { ...cat, contestants: [...cat.contestants, ...imported] }
      if (cat.subcategories.length > 0) return { ...cat, subcategories: injectImported(cat.subcategories, targetId, imported) }
      return cat
    })

  const handleImport = (imported: CreateContestantForm[]) => {
    const mapped = imported.map(fromImportedContestant)
    if (importTarget === "root") {
      setContestants((prev) => [...prev, ...mapped])
    } else if (importTarget) {
      setCategories((prev) => injectImported(prev, importTarget, mapped))
    }
  }

  // ── Import whole categories from nominees ───────────────────────────────────
  // "root" targets the top-level category list; any other value is the
  // categoryId whose subcategories slot should receive the imported categories.
  const [importCategoriesTarget, setImportCategoriesTarget] = useState<string | null>(null)

  const injectImportedCategories = (cats: CategoryForm[], targetId: string, imported: CategoryForm[]): CategoryForm[] =>
    cats.map((cat) => {
      if (cat.categoryId === targetId) return { ...cat, subcategories: [...cat.subcategories, ...imported] }
      if (cat.subcategories.length > 0) return { ...cat, subcategories: injectImportedCategories(cat.subcategories, targetId, imported) }
      return cat
    })

  const handleImportCategories = (imported: CreateCategoryForm[]) => {
    const mapped = imported.map(fromImportedCategory)
    if (importCategoriesTarget === "root") {
      setCategories((prev) => [...prev, ...mapped])
    } else if (importCategoriesTarget) {
      setCategories((prev) => injectImportedCategories(prev, importCategoriesTarget, mapped))
    }
  }

  // ── Fill with JSON ───────────────────────────────────────────────────────────
  // Always targets the root — flat contestants for single polls, top-level
  // categories for group polls — and only ever appends: editing with JSON
  // never overwrites anything already on the poll (per babe's spec).
  const [showJsonDialog, setShowJsonDialog] = useState(false)

  // ── Step navigation ─────────────────────────────────────────────────────────
  const goToStep = (next: number) => {
    let errs: string[] = []
    if (currentStep === 1) errs = validateStep1(meta)
    if (currentStep === 2) errs = validateStep2(meta)
    setStepErrors(errs)
    if (errs.length === 0) setCurrentStep(next)
  }

  const totalSubcats = countSubcategories(categories)

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = validateStep3(meta, contestants, categories, limits)
    if (errs.length) { setStepErrors(errs); return }
    setSubmitting(true); setStepErrors([])

    try {
      const payload: Record<string, any> = {
        pollId,
        pollName:        meta.pollName,
        pollImage:       meta.pollImageUrl,
        pollDescription: meta.pollDescription,
        pollStartDate:   meta.pollStartDate,
        pollStartTime:   meta.pollStartTime,
        pollEndDate:     meta.pollEndDate,
        pollEndTime:     meta.pollEndTime,
        statsVisible:    meta.statsVisible,
      }

      if (meta.pollType === "single") {
        payload.pollPrice   = meta.pollPrice
        payload.contestants = contestants.map((c) => ({
          contestantId: c.contestantId, name: c.name, image: c.imageUrl,
          imageType: c.imageType ?? "uploaded",
          imageSeed: c.imageType === "generated" ? c.contestantId : null,
        }))
      } else {
        payload.categories = categories.map(serializeCategory)
      }

      const res  = await authFetch("/api/polls/update", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setStepErrors([data.error || "Failed to save changes"]); return }

      setSaved(true)
      // Team members don't have access to the main poll page (owner-only),
      // so send them back to their own dashboard instead of bouncing them
      // through a 403 on redirect.
      setTimeout(() => router.push(access === "member" ? "/polls" : `/polls/${pollId}`), 1200)
    } catch {
      setStepErrors(["An unexpected error occurred. Please try again."])
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingPoll) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader className="w-8 h-8 animate-spin text-[#6b2fa5]" /></div>
  }

  // Neither the owner nor an active poll team member — bounce out cleanly
  // instead of rendering a form the caller has no right to see.
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <p className="font-semibold text-gray-900">Can't open this poll</p>
          <p className="text-sm text-gray-500">{loadError}</p>
          <Link href="/polls" className="inline-flex items-center gap-2 text-sm font-semibold text-[#6b2fa5] hover:underline mt-2">
            <ArrowLeft className="w-4 h-4" /> Back to Polls
          </Link>
        </div>
      </div>
    )
  }

  const isGroup = meta.pollType === "group"
  const isTeamMember = access === "member"
  const steps = [
    { n: 1, label: "Poll Info",  icon: Info     },
    { n: 2, label: "Schedule",   icon: Calendar },
    { n: 3, label: isGroup ? "Categories" : "Contestants", icon: Users },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <UnsavedChangesDialog open={showConfirmDialog} onConfirm={confirmLeave} onCancel={cancelLeave} />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {isTeamMember ? (
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 mb-6">
            <UserCog className="w-4 h-4" /> Editing as poll team member
          </div>
        ) : (
          <Link
            href={`/polls/${pollId}`}
            onClick={guardNavigation(() => router.push(`/polls/${pollId}`))}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Poll
          </Link>
        )}

        <div className="mb-8">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Edit Poll</h1>
            {isTeamMember ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <ShieldCheck className="w-3 h-3" /> Team Member
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Crown className="w-3 h-3" /> Poll Creator
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {isGroup ? "Update categories, sub-categories, and contestants" : "Update poll details or contestants"}
            {isTeamMember && " · Payouts and poll settings stay with the poll creator"}
          </p>
          <div className="flex items-center gap-2 mt-5">
            {steps.map((s, idx) => {
              const Icon = s.icon; const active = currentStep === s.n; const done = currentStep > s.n
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

        {voteStats && <VoteStatsPanel stats={voteStats} />}

        {saved && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <p className="text-sm font-semibold text-green-800">Changes saved! Redirecting…</p>
          </div>
        )}
        {stepErrors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-800 mb-1">Please fix the following:</p>
              {stepErrors.map((e, i) => <p key={i} className="text-xs text-red-700">• {e}</p>)}
            </div>
          </div>
        )}

        {/* ── STEP 1 ─────────────────────────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-[#6b2fa5]" /> Basic Information
            </h2>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Poll Name *</label>
              <input type="text" value={meta.pollName} onChange={(e) => setMeta({ ...meta, pollName: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#6b2fa5]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Cover Image *{" "}
                {meta.pollImageUploading && <Loader className="w-3 h-3 inline animate-spin text-[#6b2fa5] ml-1" />}
                {meta.pollImageUrl && !meta.pollImageUploading && <CheckCircle className="w-3 h-3 inline text-green-500 ml-1" />}
              </label>
              <label htmlFor="edit-cover"
                className={`block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
                  ${meta.pollImageUploading ? "opacity-60 pointer-events-none" : "hover:border-[#6b2fa5]/40 hover:bg-[#6b2fa5]/5"}
                  ${meta.pollImageUrl ? "border-green-300 bg-green-50/30" : "border-gray-200"}`}>
                {meta.pollImagePreview
                  ? <div className="w-full aspect-video rounded-lg overflow-hidden"><img src={meta.pollImagePreview} alt="" className="w-full h-full object-cover" /></div>
                  : <div className="py-4"><ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-xs text-gray-400">Click to change cover image</p></div>}
              </label>
              <input id="edit-cover" type="file" accept="image/*" className="hidden" onChange={handlePollImageChange} disabled={meta.pollImageUploading} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Description *</label>
              <textarea value={meta.pollDescription} onChange={(e) => setMeta({ ...meta, pollDescription: e.target.value })}
                rows={4} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#6b2fa5] resize-none" />
            </div>
            {/* Stats visibility */}
            <div className="flex items-start justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div>
                <p className="text-xs font-semibold text-gray-800">Show Vote Stats to Voters</p>
                <p className="text-xs text-gray-400 mt-0.5">If off, voters cannot see live vote counts.</p>
              </div>
              <button onClick={() => setMeta((p) => ({ ...p, statsVisible: !p.statsVisible }))} className="flex-shrink-0">
                {meta.statsVisible ? <ToggleRight className="w-8 h-8 text-[#6b2fa5]" /> : <ToggleLeft className="w-8 h-8 text-gray-400" />}
              </button>
            </div>
            <div className="flex justify-end pt-1">
              <button onClick={() => goToStep(2)} disabled={meta.pollImageUploading}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#6b2fa5] text-white rounded-lg text-sm font-semibold hover:bg-[#5a1f8a] disabled:opacity-50">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 ─────────────────────────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#6b2fa5]" /> Schedule{!isGroup ? " & Pricing" : ""}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {([
                { label: "Start Date", type: "date", key: "pollStartDate" },
                { label: "Start Time", type: "time", key: "pollStartTime" },
                { label: "End Date",   type: "date", key: "pollEndDate", min: meta.pollStartDate || undefined },
                { label: "End Time",   type: "time", key: "pollEndTime" },
              ] as any[]).map(({ label, type, key, min }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">{label} *</label>
                  <input type={type} min={min} value={(meta as any)[key]}
                    onChange={(e) => setMeta({ ...meta, [key]: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#6b2fa5]" />
                </div>
              ))}
            </div>
            {!isGroup && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Price Per Vote (₦) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                  <input type="number" min="0" step="50" value={meta.pollPrice}
                    onChange={(e) => setMeta({ ...meta, pollPrice: Number(e.target.value) })}
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#6b2fa5]" />
                </div>
                <p className="text-xs text-gray-400 mt-1">₦0 = free · ₦{MIN_VOTE_PRICE}–₦{MAX_VOTE_PRICE.toLocaleString()} for paid</p>
              </div>
            )}
            {isGroup && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                Prices are set per category in the next step.
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setStepErrors([]); setCurrentStep(1) }}
                className="flex items-center gap-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => goToStep(3)}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#6b2fa5] text-white rounded-lg text-sm font-semibold hover:bg-[#5a1f8a]">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ─────────────────────────────────────────────────────── */}
        {currentStep === 3 && (
          <div className="space-y-4">
            {/* Single poll */}
            {!isGroup && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#6b2fa5]" /> Contestants
                  </h2>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{contestants.length}/{limits.maxSingleContestants}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {contestants.map((c, idx) => (
                    <ContestantRow key={idx} c={c} idx={idx}
                      onUpdate={(p) => updCont(idx, p)}
                      onRemove={() => setContestants((p) => p.filter((_, i) => i !== idx))}
                      canRemove={contestants.length > 2} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {contestants.length < limits.maxSingleContestants && (
                    <button onClick={() => setContestants((p) => [...p, emptyContestant()])}
                      className="flex items-center gap-1.5 text-sm font-semibold text-[#6b2fa5] hover:bg-[#6b2fa5]/5 px-3 py-2 rounded-lg transition-colors">
                      <Plus className="w-4 h-4" /> Add Contestant
                    </button>
                  )}
                  <button onClick={() => setImportTarget("root")}
                    className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 border border-gray-300 hover:border-[#6b2fa5] hover:text-[#6b2fa5] px-3 py-2 rounded-lg transition-colors">
                    <Download className="w-4 h-4" /> Import from Nominees
                  </button>
                  <button onClick={() => setShowJsonDialog(true)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 border border-gray-300 hover:border-[#6b2fa5] hover:text-[#6b2fa5] px-3 py-2 rounded-lg transition-colors">
                    <FileJson className="w-4 h-4" /> Fill with JSON
                  </button>
                </div>
              </div>
            )}

            {/* Group poll */}
            {isGroup && (
              <div className="space-y-3">
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-[#6b2fa5]" /> Award Categories
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 bg-[#6b2fa5]/5 rounded-lg">
                      <p className="text-xs text-gray-500">Top-level</p>
                      <p className={`text-lg font-bold ${categories.length > limits.maxGroupTopCategories ? "text-red-600" : "text-[#6b2fa5]"}`}>
                        {categories.length}/{limits.maxGroupTopCategories}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-[#6b2fa5]/5 rounded-lg">
                      <p className="text-xs text-gray-500">Sub-categories</p>
                      <p className={`text-lg font-bold ${totalSubcats > limits.maxGroupTotalSubcategories ? "text-red-600" : "text-[#6b2fa5]"}`}>
                        {totalSubcats}/{limits.maxGroupTotalSubcategories}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-2 text-center font-medium">
                    ⚠️ Categories and contestants with existing votes cannot be deleted.
                  </p>
                </div>
                <div className="space-y-3">
                  {categories.map((cat, ci) => (
                    <CategoryBlock key={cat.categoryId} cat={cat} path="Poll" depth={0}
                      totalSubcats={totalSubcats} limits={limits}
                      onUpdate={(u) => setCategories((prev) => prev.map((c, i) => i === ci ? u : c))}
                      onRemove={() => setCategories((prev) => prev.filter((_, i) => i !== ci))}
                      canRemove={!cat.hasVotes && categories.length > 1}
                      onOpenImport={(targetId) => setImportTarget(targetId)}
                      onOpenImportCategories={(targetId) => setImportCategoriesTarget(targetId)} />
                  ))}
                </div>
                {categories.length < limits.maxGroupTopCategories && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setCategories((p) => [...p, emptyCategory()])}
                      className="flex-1 py-3 border-2 border-dashed border-[#6b2fa5]/30 text-[#6b2fa5] rounded-xl text-sm font-medium hover:bg-[#6b2fa5]/5 flex items-center justify-center gap-2">
                      <FolderPlus className="w-4 h-4" /> Add Top-Level Category
                    </button>
                    <button onClick={() => setImportCategoriesTarget("root")}
                      className="flex-1 py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl text-sm font-medium hover:border-[#6b2fa5]/40 hover:text-[#6b2fa5] flex items-center justify-center gap-2">
                      <Layers className="w-4 h-4" /> Import Categories
                    </button>
                    <button onClick={() => setShowJsonDialog(true)}
                      className="flex-1 py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl text-sm font-medium hover:border-[#6b2fa5]/40 hover:text-[#6b2fa5] flex items-center justify-center gap-2">
                      <FileJson className="w-4 h-4" /> Fill with JSON
                    </button>
                  </div>
                )}
              </div>
            )}

            {importTarget && (
              <ImportNomineesDialog
                onClose={() => setImportTarget(null)}
                onImport={handleImport}
              />
            )}

            {importCategoriesTarget && (
              <ImportNomineesCategoryDialog
                onClose={() => setImportCategoriesTarget(null)}
                onImport={handleImportCategories}
              />
            )}

            {showJsonDialog && (
              <FillWithJsonDialog
                pollType={isGroup ? "group" : "single"}
                pollId={pollId}
                existingContestantsCount={contestants.length}
                maxSingleContestants={limits.maxSingleContestants}
                onImportContestants={(imported) => setContestants((prev) => [...prev, ...imported.map(fromImportedContestant)])}
                existingTopCount={categories.length}
                existingTotalSubcount={totalSubcats}
                maxGroupTopCategories={limits.maxGroupTopCategories}
                maxGroupTotalSubcategories={limits.maxGroupTotalSubcategories}
                maxContestantsPerCategory={limits.maxContestantsPerCategory}
                onImportCategories={(imported) => setCategories((prev) => [...prev, ...imported.map(fromImportedCategory)])}
                onClose={() => setShowJsonDialog(false)}
              />
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStepErrors([]); setCurrentStep(2) }}
                className="flex items-center gap-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handleSave} disabled={submitting || (!isGroup && contestants.some((c) => c.uploading))}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#6b2fa5] text-white rounded-lg text-sm font-semibold hover:bg-[#5a1f8a] disabled:opacity-60">
                {submitting ? <><Loader className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
