/**
 * lib/json-import.ts
 *
 * Parsing + limit-enforcement logic behind the "Fill with JSON" button on
 * the Contestants step (create and edit flows both use this — see
 * ../components/FillWithJsonDialog.tsx).
 *
 * Two JSON shapes are accepted:
 *   • Single polls  — a flat array of contestant names (or `{name}` objects),
 *     optionally wrapped as `{ "contestants": [...] }`.
 *   • Group polls   — a tree of categories, optionally wrapped as
 *     `{ "categories": [...] }`. Each category may carry a `contestants`
 *     array (leaf categories only) and/or a `subcategories` array.
 *
 * Every contestant that comes in through JSON gets a Dicebear avatar
 * generated automatically (imageType: "generated", same convention as the
 * "Import from Nominees" dialogs) — bookers can swap it for an uploaded
 * photo afterwards like any other contestant.
 */

import { dicebearAvatarUrl } from "@/lib/dicebear"
import { genContestantId, genCategoryId, type ContestantForm, type CategoryForm } from "./factories"

// ── Depth limit ──────────────────────────────────────────────────────────────

/**
 * Maximum category depth reachable through the UI itself: CategoryBlock only
 * renders the "Add Sub-category" control while `depth < 2`, so a category can
 * have children at depth 1 and depth 2, but a depth-2 category is always a
 * leaf. That's 3 tiers total (0, 1, 2) — JSON imports honour the same ceiling
 * so a pasted structure can never produce something the manual UI couldn't.
 */
export const MAX_JSON_CATEGORY_DEPTH = 2

export interface JsonImportSkipCounts {
  contestants: number
  categories: number
}

interface RawCategoryInput {
  name?: unknown
  pollPrice?: unknown
  contestants?: unknown
  subcategories?: unknown
}

function extractName(entry: unknown): string | null {
  if (typeof entry === "string") return entry.trim() || null
  if (entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
    return ((entry as { name: string }).name.trim()) || null
  }
  return null
}

function buildContestant(name: string): ContestantForm {
  const url = dicebearAvatarUrl(name)
  return {
    contestantId: genContestantId(),
    name,
    imagePreview: url,
    imageUrl: url,
    imageType: "generated",
    uploading: false,
  }
}

// ── Flat contestants (single polls) ─────────────────────────────────────────

export function parseContestantsJson(raw: string): { list: string[] } | { error: string } {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { error: "That doesn't look like valid JSON — check for missing commas, quotes, or brackets." }
  }

  const arr = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { contestants?: unknown }).contestants)
    ? (data as { contestants: unknown[] }).contestants
    : null

  if (!arr) return { error: `Expected a JSON array of contestant names, or {"contestants": [...]}.` }

  const names = arr.map(extractName).filter((n): n is string => !!n)
  if (names.length === 0) return { error: "No valid contestant names found in that JSON." }
  return { list: names }
}

/**
 * Accepts up to `budget` names (budget already accounts for whatever's
 * already in the list — see FillWithJsonDialog), generating a Dicebear
 * contestant for each. Anything beyond budget is reported as skipped, never
 * silently dropped.
 */
export function buildContestantsFromNames(
  names: string[],
  budget: number
): { accepted: ContestantForm[]; skipped: number } {
  if (budget <= 0) return { accepted: [], skipped: names.length }
  const accepted = names.slice(0, budget).map(buildContestant)
  return { accepted, skipped: names.length - accepted.length }
}

// ── Category tree (group polls) ─────────────────────────────────────────────

export function parseCategoriesJson(raw: string): { list: RawCategoryInput[] } | { error: string } {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { error: "That doesn't look like valid JSON — check for missing commas, quotes, or brackets." }
  }

  const arr = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { categories?: unknown }).categories)
    ? (data as { categories: unknown[] }).categories
    : null

  if (!arr) return { error: `Expected a JSON array of categories, or {"categories": [...]}.` }
  if (arr.length === 0) return { error: "No categories found in that JSON." }
  return { list: arr as RawCategoryInput[] }
}

interface BuildTreeOptions {
  /** Remaining Tier-1 slots — MAX_GROUP_TOP_CATEGORIES minus what's already there. */
  topBudget: number
  /** Remaining Tier-2+ slots, shared across the whole imported tree — mirrors
   *  countSubcategories() in lib/poll-config.ts. */
  subBudget: number
  maxContestantsPerCategory: number
}

interface BuildTreeResult {
  categories: CategoryForm[]
  skipped: JsonImportSkipCounts
}

/** Recursively tallies every category + contestant inside a raw JSON node,
 *  used to report accurate skip counts when a whole branch is dropped
 *  (over the top-level cap, the sub-category budget, or too deep). */
function countRawNode(node: RawCategoryInput): JsonImportSkipCounts {
  const counts: JsonImportSkipCounts = { categories: 1, contestants: 0 }
  const subs = Array.isArray(node.subcategories) ? (node.subcategories as RawCategoryInput[]) : []
  if (subs.length > 0) {
    for (const sub of subs) {
      const c = countRawNode(sub)
      counts.categories += c.categories
      counts.contestants += c.contestants
    }
  } else if (Array.isArray(node.contestants)) {
    counts.contestants += node.contestants.filter((n) => extractName(n)).length
  }
  return counts
}

/**
 * Walks the pasted category tree top to bottom, importing what fits within
 * the resolved limits and reporting everything that didn't — split out by
 * whether the dropped item was a category or a contestant, per item 4 of
 * the spec.
 */
export function buildCategoryTreeFromJson(rawList: RawCategoryInput[], opts: BuildTreeOptions): BuildTreeResult {
  const skipped: JsonImportSkipCounts = { contestants: 0, categories: 0 }
  let subBudgetRemaining = opts.subBudget

  const dropSubtree = (node: RawCategoryInput) => {
    const c = countRawNode(node)
    skipped.categories += c.categories
    skipped.contestants += c.contestants
  }

  const processNode = (node: RawCategoryInput, depth: number): CategoryForm => {
    const name = typeof node.name === "string" ? node.name.trim() : ""
    const pollPrice = typeof node.pollPrice === "number" && Number.isFinite(node.pollPrice) ? node.pollPrice : 100
    const rawSubs = Array.isArray(node.subcategories) ? (node.subcategories as RawCategoryInput[]) : []

    let subcategories: CategoryForm[] = []
    if (rawSubs.length > 0) {
      if (depth >= MAX_JSON_CATEGORY_DEPTH) {
        // Nested deeper than the manual UI ever allows — drop the whole branch.
        rawSubs.forEach(dropSubtree)
      } else {
        for (const sub of rawSubs) {
          if (subBudgetRemaining <= 0) { dropSubtree(sub); continue }
          subBudgetRemaining -= 1
          subcategories.push(processNode(sub, depth + 1))
        }
      }
    }

    // Contestants only ever live on a leaf — mirrors serializeCategory(), which
    // drops a category's own contestants the moment it has subcategories.
    let contestants: ContestantForm[] = []
    if (subcategories.length === 0 && Array.isArray(node.contestants)) {
      const names = (node.contestants as unknown[]).map(extractName).filter((n): n is string => !!n)
      const { accepted, skipped: sc } = buildContestantsFromNames(names, opts.maxContestantsPerCategory)
      contestants = accepted
      skipped.contestants += sc
    }

    return { categoryId: genCategoryId(), name, pollPrice, contestants, subcategories, expanded: true }
  }

  const categories: CategoryForm[] = []
  rawList.forEach((node, i) => {
    if (i >= opts.topBudget) { dropSubtree(node); return }
    categories.push(processNode(node, 0))
  })

  return { categories, skipped }
}
