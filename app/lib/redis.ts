/**
 * lib/redis.ts
 * Same Upstash Redis instance used by the standalone spotix-api service.
 * Booker reads from it (never writes rate-limit counters itself) to show
 * live usage stats on the SDK key management page and IT dashboard.
 */

import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export function minuteBucket(date: Date = new Date()): string {
  return date.toISOString().slice(0, 16)
}

export function dayBucketWAT(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(date)
}

// ─── Simple JSON cache helpers ────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get<T>(key)
    return value ?? null
  } catch (err) {
    console.error(`[redis] cacheGet failed for "${key}":`, err)
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch (err) {
    console.error(`[redis] cacheSet failed for "${key}":`, err)
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch (err) {
    console.error(`[redis] cacheDel failed for "${key}":`, err)
  }
}

// ─── Single-flight ("first past the post") cache ──────────────────────────
//
// Ported from spotix-vote/src/lib/redis.ts — see that file for the full
// rationale. Used by poll-categories.ts's fetchCategoryTree(), which
// shares the exact same `poll-categories:{pollId}` Redis key with
// spotix-vote's fetchCategoryTreeForPoll() and gets busted by the same
// spotix-backend allocate-vote.js invalidation on every credited vote —
// so it's exposed to the identical thundering-herd risk on cache miss
// during a vote spike. Keep the two implementations in sync if either
// changes.

const LOCK_TTL_SECONDS = 8
const FOLLOWER_POLL_INTERVAL_MS = 100
const FOLLOWER_MAX_WAIT_MS = 4000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Cached read with single-flight de-duplication on miss.
 *
 * @param key         Cache key
 * @param ttlSeconds  How long a fresh value stays cached
 * @param fetcher     Loads the value from the origin (e.g. Firestore) on a
 *                     true cache miss. Only the elected "leader" calls this
 *                     under normal conditions.
 */
export async function getOrSetSingleFlight<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T | null>
): Promise<T | null> {
  // 1. Fast path instant cache hit, no coordination needed.
  const cached = await cacheGet<T>(key)
  if (cached !== null) return cached

  // 2. Cache miss — race for the lock. Whoever wins becomes the leader.
  const lockKey = `lock:${key}`
  let isLeader = false
  try {
    const lockResult = await redis.set(lockKey, "1", { nx: true, ex: LOCK_TTL_SECONDS })
    isLeader = lockResult === "OK"
  } catch (err) {
    // Redis itself is unreachable — fail open and hit the origin directly
    // rather than blocking the request.
    console.error(`[redis] lock acquisition failed for "${key}", fetching directly:`, err)
    return fetcher()
  }

  if (isLeader) {
    try {
      const fresh = await fetcher()
      if (fresh !== null) {
        await cacheSet(key, fresh, ttlSeconds)
      }
      return fresh
    } finally {
      // Best-effort unlock so the next genuine miss doesn't wait out the
      // full lock TTL unnecessarily. Not awaited-critical — if this fails,
      // the lock just expires on its own shortly after.
      cacheDel(lockKey).catch(() => {})
    }
  }

  // 3. Follower — someone else is already fetching. Poll the cache (never
  // Firestore) until the leader fills it in, or give up after a bounded
  // wait and fetch directly so a stuck/crashed leader can't wedge us.
  const start = Date.now()
  while (Date.now() - start < FOLLOWER_MAX_WAIT_MS) {
    await sleep(FOLLOWER_POLL_INTERVAL_MS)
    const value = await cacheGet<T>(key)
    if (value !== null) return value
  }

  console.warn(`[redis] single-flight follower timed out waiting for "${key}", fetching directly`)
  return fetcher()
}
