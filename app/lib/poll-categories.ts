/**
 * app/lib/poll-categories.ts
 *
 * Storage layer for group-poll categories, backed by a SUBCOLLECTION
 * instead of the old `categories` array field on the poll document.
 *
 *   voting/{pollId}/categories/{categoryId}   ← one doc per node (root or nested)
 *
 * Each doc:
 *   {
 *     categoryId, name, pollPrice,
 *     parentId:  string | null,   // null = top-level (Tier 1)
 *     depth:     number,          // 0 = top-level
 *     path:      string[],        // ANCESTOR NAMES (not ids), for breadcrumbs —
 *                                  // e.g. ["Male", "Under 18"] for a "Best Dancer"
 *                                  // leaf nested two levels deep. Denormalized here
 *                                  // on purpose so a leaf category is displayable
 *                                  // on its own without walking the tree.
 *     hasChildren: boolean,
 *     contestants: [...],         // only non-empty on leaf nodes (hasChildren: false)
 *     createdAt, updatedAt
 *   }
 *
 * Why this exists: the old model stored the ENTIRE nested category tree —
 * up to 200 category nodes × up to 35 contestants each — as one array
 * field on the poll document. Two things broke because of it:
 *
 *   1. It's unreadable in the Firestore console once it grows past a
 *      couple hundred elements (this is what prompted this change — see
 *      the screenshot: "Array of ~2100 is too large to display").
 *   2. Every single vote had to read the WHOLE tree, patch one
 *      contestant's count deep inside it, and write the WHOLE tree back
 *      (see spotix-backend's old allocate-vote.js). Two votes landing on
 *      different categories of the same poll within the same moment
 *      would race — the second write silently clobbers the first's
 *      change to unrelated categories. Splitting categories into their
 *      own documents means a vote only ever touches the ONE leaf
 *      category doc it targets.
 *
 * The booker create/edit UI is UNCHANGED by this — CategoryForm[] in
 * React state, and the JSON tree posted to /api/polls/create and
 * /api/polls/update, both stay exactly the same nested shape. Only the
 * server-side storage changed: flattenCategoryTree()/buildCategoryTree()
 * convert between that nested wire shape and the flat subcollection.
 *
 * Legacy fallback: a poll created before this change still has its tree
 * sitting in the `categories` array field and an EMPTY subcollection.
 * fetchCategoryTree() falls back to that array automatically when the
 * subcollection is empty — see the `legacyCategories` param — so nothing
 * breaks for a poll that hasn't been through /admin/migrate-categories
 * or an edit-and-save yet. The moment a poll is created, edited, or
 * migrated, it's fully on the subcollection and the array field is
 * cleared.
 *
 * Caching: the assembled tree (structure + live vote counts) is cached
 * in Redis per poll for up to 1 hour as a safety net, and actively
 * invalidated on every write that touches it — every save here, AND
 * every vote credited in spotix-backend's allocate-vote.js (which calls
 * the same invalidation key format — see that repo's redis.js). In
 * steady state the TTL should essentially never be the thing that
 * refreshes this cache; invalidation should always beat it there.
 */

import { adminDb } from "@/lib/firebase-admin"
import { redis, getOrSetSingleFlight } from "@/lib/redis"
import { FieldValue } from "firebase-admin/firestore"

const CATEGORY_TREE_CACHE_TTL_SECONDS = 60 * 60 // 1 hour safety-net TTL

export function categoryTreeCacheKey(pollId: string): string {
  return `poll-categories:${pollId}`
}

export interface CategoryDoc {
  categoryId: string
  name: string
  pollPrice: number
  parentId: string | null
  depth: number
  path: string[]
  hasChildren: boolean
  contestants: any[]
}

// ─── Tree ⇄ flat-docs conversion ────────────────────────────────────────────

/** Nested CategoryForm-shaped tree (as posted from the client) → flat subcollection docs. */
export function flattenCategoryTree(
  nodes: any[],
  parentId: string | null = null,
  parentPath: string[] = [],
): CategoryDoc[] {
  const out: CategoryDoc[] = []
  for (const node of nodes) {
    const hasChildren = Array.isArray(node.subcategories) && node.subcategories.length > 0
    const name = String(node.name ?? "").trim()
    out.push({
      categoryId: node.categoryId,
      name,
      pollPrice: Number(node.pollPrice ?? 0),
      parentId,
      depth: parentPath.length,
      path: parentPath,
      hasChildren,
      contestants: hasChildren ? [] : (node.contestants ?? []),
    })
    if (hasChildren) {
      out.push(...flattenCategoryTree(node.subcategories, node.categoryId, [...parentPath, name]))
    }
  }
  return out
}

/** Flat subcollection docs → the nested tree shape the booker UI + spotix-vote expect. */
export function buildCategoryTree(docs: CategoryDoc[]): any[] {
  const byParent = new Map<string | null, CategoryDoc[]>()
  for (const d of docs) {
    const list = byParent.get(d.parentId) ?? []
    list.push(d)
    byParent.set(d.parentId, list)
  }

  function build(parentId: string | null): any[] {
    return (byParent.get(parentId) ?? []).map((d) => ({
      categoryId: d.categoryId,
      name: d.name,
      pollPrice: d.pollPrice,
      contestants: d.contestants ?? [],
      subcategories: build(d.categoryId),
    }))
  }

  return build(null)
}

/** Flat map keyed by categoryId — used by the update route's vote-preservation merge check. */
export function flattenTreeToMap(tree: any[]): Map<string, any> {
  const map = new Map<string, any>()
  function walk(nodes: any[]) {
    for (const n of nodes) {
      map.set(n.categoryId, n)
      if (Array.isArray(n.subcategories)) walk(n.subcategories)
    }
  }
  walk(tree)
  return map
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/**
 * Fetches the full category tree for a poll.
 *
 * @param pollId
 * @param opts.legacyCategories - the poll doc's old `categories` array
 *   field, if any — used as a fallback ONLY when the subcollection is
 *   still empty (poll hasn't been migrated/re-saved yet).
 * @param opts.skipCache - bypass Redis (and single-flight) and read Firestore
 *   directly. Callers that are about to VALIDATE against live data (the
 *   update route's vote-preservation checks) should always pass this, since
 *   a stale cache could let a just-voted contestant look removable.
 *
 * Single-flight on miss: this key is busted on EVERY credited vote (see
 * spotix-backend's allocate-vote.js), so during a vote spike it goes cold
 * repeatedly right when concurrent traffic is highest. A plain get/set
 * would mean every request racing through that gap pays for the full
 * subcollection query independently — see getOrSetSingleFlight in
 * @/lib/redis for the leader/follower lock that prevents that.
 */
export async function fetchCategoryTree(
  pollId: string,
  opts: { legacyCategories?: any[]; skipCache?: boolean } = {},
): Promise<any[]> {
  const cacheKey = categoryTreeCacheKey(pollId)

  const fetchFromFirestore = async (): Promise<any[]> => {
    const snap = await adminDb.collection("voting").doc(pollId).collection("categories").get()
    if (snap.empty) {
      // Not migrated yet — serve straight from the legacy array field so
      // nothing breaks before this poll's next edit or a bulk migration.
      return opts.legacyCategories ?? []
    }
    const docs = snap.docs.map((d) => d.data() as CategoryDoc)
    return buildCategoryTree(docs)
  }

  if (opts.skipCache) return fetchFromFirestore()

  const tree = await getOrSetSingleFlight<any[]>(
    cacheKey,
    CATEGORY_TREE_CACHE_TTL_SECONDS,
    fetchFromFirestore,
  )
  return tree ?? opts.legacyCategories ?? []
}

export async function invalidateCategoryTreeCache(pollId: string): Promise<void> {
  try {
    await redis.del(categoryTreeCacheKey(pollId))
  } catch {
    /* non-fatal */
  }
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/**
 * Replaces a poll's entire category subcollection with `tree` — used by
 * both poll creation and full-tree edits. Upserts every node present in
 * `tree`, deletes any subcollection doc no longer present (the caller is
 * expected to have already checked that nothing with votes is being
 * removed — see the update route's validateAndMergeCategoryTree), and
 * clears the legacy array field + invalidates the cache.
 *
 * Group-poll limits (50 top-level + 150 nested = 200 nodes max) fit
 * comfortably inside Firestore's 500-write batch cap, so this never
 * needs to be split across multiple batches.
 */
export async function writeCategoryTree(pollId: string, tree: any[]): Promise<void> {
  const pollRef = adminDb.collection("voting").doc(pollId)
  const catsRef = pollRef.collection("categories")

  const incoming = flattenCategoryTree(tree)
  const incomingIds = new Set(incoming.map((c) => c.categoryId))

  const existingSnap = await catsRef.get()
  const existingIds = new Set(existingSnap.docs.map((d) => d.id))

  const batch = adminDb.batch()
  const now = FieldValue.serverTimestamp()

  for (const node of incoming) {
    const payload: Record<string, any> = { ...node, updatedAt: now }
    if (!existingIds.has(node.categoryId)) payload.createdAt = now
    batch.set(catsRef.doc(node.categoryId), payload, { merge: true })
  }
  for (const id of existingIds) {
    if (!incomingIds.has(id)) batch.delete(catsRef.doc(id))
  }

  // Poll is now fully subcollection-backed — drop the legacy array so it
  // can't grow back into the "too large to display" state, and so
  // fetchCategoryTree() stops treating this poll as unmigrated.
  batch.update(pollRef, { categories: FieldValue.delete(), updatedAt: now })

  await batch.commit()
  await invalidateCategoryTreeCache(pollId)
}
