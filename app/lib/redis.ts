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
