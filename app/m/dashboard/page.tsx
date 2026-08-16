"use client"

import { useCallback, useEffect, useState } from "react"
import { useProtectedPage } from "@/hooks/useProtectedPage"
import { useAuth } from "@/hooks/useAuth"
import { authFetch } from "@/lib/auth-client"
import { PwaDashboardGreeting } from "../components/dashboard/PwaDashboardGreeting"
import { PwaStatsGrid } from "../components/dashboard/PwaStatsGrid"
import { PwaRevenueChart } from "../components/dashboard/PwaRevenueChart"
import { PwaPurchaseTrendChart } from "../components/dashboard/PwaPurchaseTrendChart"
import { PwaRecentActivity } from "../components/dashboard/PwaRecentActivity"
import { PwaEventsSection } from "../components/dashboard/PwaEventsSection"
import { PwaQuickActions } from "../components/dashboard/PwaQuickActions"
import { PwaDashboardSkeleton } from "../components/dashboard/PwaDashboardSkeleton"
import { PwaSkelCard } from "../components/PwaSkeleton"

interface DashboardStats {
  totalEvents: number
  activeEvents: number
  inactiveEvents: number
  totalRevenue: number
  availableBalance: number
  totalPaidOut: number
  totalTicketsSold: number
}

interface SeriesPoint {
  label: string
  date: string
  revenue: number
  ticketsSold: number
}

interface TimeSeries {
  daily: SeriesPoint[]
  monthly: SeriesPoint[]
  yearly: SeriesPoint[]
}

interface DashEvent {
  id: string
  eventName: string
  eventDate: string
  ticketsSold: number
  revenue: number
  availableBalance: number
  status: string
}

interface DayBucket {
  date: string
  label: string
  ticketsPurchased: number
  votesCast: number
}

interface ActivityItem {
  id: string
  kind: "voting" | "nomination"
  pollName: string
  pollImage: string
  status: string
  createdAt: string | null
  linkedEventName: string | null
}

interface CachedDashboard {
  stats: DashboardStats
  events: DashEvent[]
  userName: string
  timeSeries: TimeSeries
  cachedAt: number
}

// Same cache key/TTL as the web dashboard (app/dashboard/page.tsx) — the PWA
// and web app can share a warm cache instead of double-fetching.
const CACHE_TTL_MS = 10 * 60 * 1000
const getCacheKey = (userId: string) => `spotix_dashboard_${userId}`

function readCache(userId: string): CachedDashboard | null {
  try {
    const raw = localStorage.getItem(getCacheKey(userId))
    if (!raw) return null
    const cached: CachedDashboard = JSON.parse(raw)
    if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(userId))
      return null
    }
    // Older cache entries (written before timeSeries existed) are stale
    // shape-wise — force a refetch instead of rendering a broken chart.
    if (!cached.timeSeries) {
      localStorage.removeItem(getCacheKey(userId))
      return null
    }
    return cached
  } catch {
    return null
  }
}

function writeCache(userId: string, data: CachedDashboard) {
  try {
    localStorage.setItem(getCacheKey(userId), JSON.stringify(data))
  } catch {}
}

function bustCache(userId: string) {
  try {
    localStorage.removeItem(getCacheKey(userId))
  } catch {}
}

export default function PwaDashboardPage() {
  useProtectedPage()
  const { user } = useAuth()
  const userId = user?.uid ?? null

  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [events, setEvents] = useState<DashEvent[]>([])
  const [timeSeries, setTimeSeries] = useState<TimeSeries | null>(null)
  const [userName, setUserName] = useState("Booker")
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [servedFromCache, setServedFromCache] = useState(false)

  // Trend + recent activity are fetched independently of the cached main
  // dashboard payload — they're cheap, always-fresh reads and shouldn't
  // block (or be blocked by) the stats/events cache lifecycle.
  const [trendDays, setTrendDays] = useState<DayBucket[] | null>(null)
  const [trendLoading, setTrendLoading] = useState(true)
  const [activityItems, setActivityItems] = useState<ActivityItem[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  const fetchDashboardData = useCallback(
    async (forceRefresh = false) => {
      if (!userId) return

      if (!forceRefresh) {
        const cached = readCache(userId)
        if (cached) {
          setStats(cached.stats)
          setEvents(cached.events)
          setUserName(cached.userName)
          setTimeSeries(cached.timeSeries)
          setLastRefreshed(new Date(cached.cachedAt))
          setServedFromCache(true)
          setLoading(false)
          setError(null)
          return
        }
      }

      try {
        setIsRefreshing(forceRefresh)
        setServedFromCache(false)

        const response = await authFetch(`/api/revenue?userId=${userId}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Failed to fetch dashboard data")

        setStats(data.stats)
        setEvents(data.recentEvents)
        setUserName(data.bookerName)
        setTimeSeries(data.timeSeries)
        setError(null)

        const now = Date.now()
        setLastRefreshed(new Date(now))
        if (forceRefresh) bustCache(userId)
        writeCache(userId, {
          stats: data.stats,
          events: data.recentEvents,
          userName: data.bookerName,
          timeSeries: data.timeSeries,
          cachedAt: now,
        })
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err)
        setError(err.message || "Failed to load dashboard data")
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    if (!userId) return
    fetchDashboardData()
    const interval = setInterval(() => fetchDashboardData(true), CACHE_TTL_MS)
    return () => clearInterval(interval)
  }, [userId, fetchDashboardData])

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    setTrendLoading(true)
    authFetch(`/api/activity/trend?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTrendDays(data.days ?? [])
      })
      .catch((err) => console.error("Error fetching activity trend:", err))
      .finally(() => {
        if (!cancelled) setTrendLoading(false)
      })

    setActivityLoading(true)
    authFetch(`/api/activity/recent`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setActivityItems(data.items ?? [])
      })
      .catch((err) => console.error("Error fetching recent activity:", err))
      .finally(() => {
        if (!cancelled) setActivityLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const handleRefresh = useCallback(() => {
    if (userId) bustCache(userId)
    fetchDashboardData(true)
  }, [userId, fetchDashboardData])

  if (loading || !stats || !timeSeries) return <PwaDashboardSkeleton />

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="text-sm font-semibold">{error}</p>
          <button onClick={handleRefresh} className="mt-1.5 text-xs underline hover:no-underline">
            Try again
          </button>
        </div>
      )}

      {servedFromCache && lastRefreshed && (
        <div className="flex items-center justify-between px-1 text-xs text-[#1e1330]/35">
          <span>
            Showing saved data from{" "}
            {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="underline hover:no-underline hover:text-[#1e1330]/60 disabled:opacity-50"
          >
            {isRefreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>
      )}

      <PwaDashboardGreeting
        userName={userName}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        lastRefreshed={lastRefreshed}
      />

      <PwaStatsGrid stats={stats} />
      <PwaRevenueChart timeSeries={timeSeries} />

      {trendLoading || !trendDays ? (
        <PwaSkelCard className="h-56 rounded-2xl" />
      ) : (
        <PwaPurchaseTrendChart days={trendDays} />
      )}

      {activityLoading || !activityItems ? (
        <PwaSkelCard className="h-72 rounded-2xl" />
      ) : (
        <PwaRecentActivity items={activityItems} />
      )}

      <PwaEventsSection events={events} />
      <PwaQuickActions />
    </div>
  )
}
