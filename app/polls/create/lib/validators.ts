import {
  MIN_VOTE_PRICE, MAX_VOTE_PRICE,
  MAX_SINGLE_CONTESTANTS, MAX_GROUP_TOP_CATEGORIES,
  MAX_GROUP_TOTAL_SUBCATEGORIES, MAX_CONTESTANTS_PER_CATEGORY,
  countSubcategories,
} from "@/lib/poll-config"
import type { ContestantForm, CategoryForm, PollForm } from "./factories"

// ─── Step validators ──────────────────────────────────────────────────────────

export function validateStep1(form: PollForm): string[] {
  const e: string[] = []
  if (!form.pollName.trim())        e.push("Poll name is required")
  if (!form.pollImageUrl)           e.push("Poll cover image is required")
  if (!form.pollDescription.trim()) e.push("Description is required")
  return e
}

export function validateStep2(form: PollForm): string[] {
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

export function validateContestants(contestants: ContestantForm[], label: string): string[] {
  const e: string[] = []
  contestants.forEach((c, i) => {
    if (!c.name.trim())        e.push(`${label} Contestant ${i + 1}: name is required`)
    if (!c.imageUrl)           e.push(`${label} Contestant ${i + 1}: photo is required`)
    if (!c.contestantId)       e.push(`${label} Contestant ${i + 1}: generate an ID first`)
  })
  return e
}

export function validateCategoryTree(cats: CategoryForm[], path: string): string[] {
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

export function validateStep3(form: PollForm, contestants: ContestantForm[], categories: CategoryForm[]): string[] {
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

export function serializeCategory(cat: CategoryForm): object {
  return {
    categoryId:   cat.categoryId,
    name:         cat.name,
    pollPrice:    cat.pollPrice,
    contestants:  cat.subcategories.length === 0
      ? cat.contestants.map((c) => ({
          contestantId: c.contestantId, name: c.name, image: c.imageUrl, votes: 0,
          imageType: c.imageType ?? "uploaded",
          imageSeed: c.imageType === "generated" ? c.contestantId : null,
        }))
      : [],
    subcategories: cat.subcategories.map(serializeCategory),
  }
}
