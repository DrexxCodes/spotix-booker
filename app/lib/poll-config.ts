/**
 * lib/poll-config.ts
 *
 * Central configuration for all Spotix poll constraints, royalty fees, and
 * structure limits. Update values here and they propagate everywhere
 * (create page, edit page, API routes, backend webhook).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  PRICING
 * ─────────────────────────────────────────────────────────────────────────────
 *  Voting fees must satisfy:   MIN_VOTE_PRICE ≤ fee ≤ MAX_VOTE_PRICE
 *  OR be exactly 0 (free poll — organiser's discretion).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  ROYALTY / SERVICE FEE
 * ─────────────────────────────────────────────────────────────────────────────
 *  Spotix charges ROYALTY_PERCENT % on every vote.
 *  buyerBearsBurden (set at poll creation, immutable):
 *    true  → buyer pays  pollPrice + (pollPrice × ROYALTY_PERCENT / 100)
 *    false → seller receives pollAmount − (pollAmount × ROYALTY_PERCENT / 100) at payout
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  POLL STRUCTURE LIMITS
 * ─────────────────────────────────────────────────────────────────────────────
 *  SINGLE POLLS
 *    • MAX_SINGLE_CONTESTANTS       — hard cap on contestants in a single poll
 *
 *  GROUP POLLS  (can have nested sub-categories)
 *    • MAX_GROUP_TOP_CATEGORIES     — max top-level categories (Tier 1)
 *    • MAX_GROUP_TOTAL_SUBCATEGORIES— max sub-categories across ALL top-level
 *                                     categories combined (any depth below Tier 1)
 *    • MAX_CONTESTANTS_PER_CATEGORY — max contestants inside any single category
 *                                     (applies at every tier level)
 *
 *  NESTING
 *    Categories can be nested to any depth.  The limits above apply as follows:
 *      - Tier 1 (root)  : count ≤ MAX_GROUP_TOP_CATEGORIES
 *      - Tier 2+        : total across the whole poll ≤ MAX_GROUP_TOTAL_SUBCATEGORIES
 *      - Contestants    : each leaf or branch category ≤ MAX_CONTESTANTS_PER_CATEGORY
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Pricing ───────────────────────────────────────────────────────────────────

/** Minimum vote price in Naira (exclusive of free polls). */
export const MIN_VOTE_PRICE = 100

/** Maximum vote price in Naira. */
export const MAX_VOTE_PRICE = 1_000

// ── Royalty / service fee ─────────────────────────────────────────────────────

/**
 * Spotix royalty percentage applied to every vote transaction.
 * e.g. 5 means 5 % of the vote amount goes to Spotix.
 */
export const ROYALTY_PERCENT = 5

// ── Single poll limits ────────────────────────────────────────────────────────

/** Maximum number of contestants allowed in a single (flat) poll. */
export const MAX_SINGLE_CONTESTANTS = 50

// ── Group poll limits ─────────────────────────────────────────────────────────

/** Maximum number of top-level (Tier 1) categories in a group poll. */
export const MAX_GROUP_TOP_CATEGORIES = 50

/**
 * Maximum total number of sub-categories (Tier 2 and deeper) across the
 * entire group poll.  Top-level categories do NOT count toward this total.
 */
export const MAX_GROUP_TOTAL_SUBCATEGORIES = 150

/**
 * Maximum contestants inside any single category at any nesting level.
 * Applies to every category, whether it is a Tier-1 root or a deep leaf.
 */
export const MAX_CONTESTANTS_PER_CATEGORY = 35

// ── Derived helpers ───────────────────────────────────────────────────────────

/**
 * Validate a vote price value against the platform constraints.
 * Returns an error string or null if valid.
 *
 * @param price  - The price in Naira to validate (should be an integer).
 * @param label  - Human-readable field label used in the error message.
 */
export function validateVotePrice(price: number, label = "Vote price"): string | null {
  if (price === 0) return null                                    // free polls are always OK
  if (!Number.isInteger(price)) return `${label} must be a whole number`
  if (price < MIN_VOTE_PRICE)
    return `${label} must be at least ₦${MIN_VOTE_PRICE.toLocaleString()} (or set to ₦0 for free)`
  if (price > MAX_VOTE_PRICE)
    return `${label} cannot exceed ₦${MAX_VOTE_PRICE.toLocaleString()}`
  return null
}

/**
 * Calculate the buyer-visible total for a given base amount when the buyer
 * bears the royalty burden.
 */
export function calcBuyerTotal(baseAmount: number): number {
  return Math.round(baseAmount * (1 + ROYALTY_PERCENT / 100))
}

/**
 * Calculate the service fee component when the buyer bears the burden.
 */
export function calcServiceFee(baseAmount: number): number {
  return calcBuyerTotal(baseAmount) - baseAmount
}

/**
 * Calculate net payout amount when the seller bears the royalty burden.
 * (i.e., Spotix deducts ROYALTY_PERCENT from the gross poll amount at payout.)
 */
export function calcSellerNet(grossAmount: number): number {
  return Math.round(grossAmount * (1 - ROYALTY_PERCENT / 100))
}

// ── Nested category helpers ───────────────────────────────────────────────────

/**
 * Counts all sub-categories (Tier 2+) recursively in a category tree.
 * Top-level categories are NOT counted — only their children and deeper.
 *
 * @param topLevelCategories  - The Tier-1 category array from the poll document.
 */
export function countSubcategories(topLevelCategories: CategoryNode[]): number {
  let total = 0
  for (const cat of topLevelCategories) {
    if (cat.subcategories && cat.subcategories.length > 0) {
      total += cat.subcategories.length
      total += countSubcategories(cat.subcategories)   // recurse deeper
    }
  }
  return total
}

/**
 * Minimal shape needed by countSubcategories — the runtime category objects
 * may have more fields; this interface only declares what the helper uses.
 */
export interface CategoryNode {
  subcategories?: CategoryNode[]
}

// ── Display helpers (used by UI components) ───────────────────────────────────

/** Human-readable summary of the group-poll structure limits. */
export const GROUP_POLL_LIMITS_SUMMARY = {
  topCategories:    `Up to ${MAX_GROUP_TOP_CATEGORIES} top-level categories`,
  subCategories:    `Up to ${MAX_GROUP_TOTAL_SUBCATEGORIES} sub-categories in total across all tiers`,
  contestantsEach:  `Up to ${MAX_CONTESTANTS_PER_CATEGORY} contestants per category`,
} as const

/** Human-readable summary of the single-poll structure limits. */
export const SINGLE_POLL_LIMITS_SUMMARY = {
  contestants: `Up to ${MAX_SINGLE_CONTESTANTS} contestants`,
} as const
