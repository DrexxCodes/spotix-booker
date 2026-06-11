"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import { Preloader } from "@/components/preloader"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { StatsGrid } from "@/components/dashboard/stats-grid"
import { EventsSection } from "@/components/dashboard/events-section"
import { QuickActions } from "@/components/dashboard/quick-actions"

interface DashboardStats {
  totalEvents: number
  activeEvents: number
  inactiveEvents: number
  totalRevenue: number
  availableBalance: number
  totalPaidOut: number
  totalTicketsSold: number
}

interface Event {
  id: string
  eventName: string
  eventDate: string
  ticketsSold: number
  revenue: number
  availableBalance: number
  status: string
}

interface CachedDashboard {
  stats: DashboardStats
  events: Event[]
  userName: string
  cachedAt: number
}

const CACHE_TTL_MS = 10 * 60 * 1000

function getCacheKey(userId: string) { return `spotix_dashboard_${userId}` }

function readCache(userId: string): CachedDashboard | null {
  try {
    const raw = localStorage.getItem(getCacheKey(userId))
    if (!raw) return null
    const cached: CachedDashboard = JSON.parse(raw)
    if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(userId))
      return null
    }
    return cached
  } catch { return null }
}

function writeCache(userId: string, data: CachedDashboard) {
  try { localStorage.setItem(getCacheKey(userId), JSON.stringify(data)) } catch {}
}

function bustCache(userId: string) {
  try { localStorage.removeItem(getCacheKey(userId)) } catch {}
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading]             = useState(true)
  const [isRefreshing, setIsRefreshing]   = useState(false)
  const [stats, setStats]                 = useState<DashboardStats | null>(null)
  const [events, setEvents]               = useState<Event[]>([])
  const [userName, setUserName]           = useState("Booker")
  const [error, setError]                 = useState<string | null>(null)
  const [userId, setUserId]               = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [servedFromCache, setServedFromCache] = useState(false)
  const [ready, setReady]                 = useState(false)

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        let token = getAccessToken()
        if (!token) {
          const refreshed = await tryRefreshTokens()
          if (!refreshed) { router.push("/login"); return }
          token = getAccessToken()
        }
        if (!token) { router.push("/login"); return }

        const userResponse = await authFetch("/api/user/me")
        if (!userResponse.ok) { router.push("/login"); return }

        const userData = await userResponse.json()
        const uid = userData?.uid || userData?.id
        if (!uid) { router.push("/login"); return }

        setUserId(uid)
      } catch (err) {
        console.error("Auth initialization error:", err)
        router.push("/login")
      }
    }
    initializeAuth()
  }, [router])

  const fetchDashboardData = useCallback(
    async (forceRefresh = false) => {
      if (!userId) return

      if (!forceRefresh) {
        const cached = readCache(userId)
        if (cached) {
          setStats(cached.stats)
          setEvents(cached.events)
          setUserName(cached.userName)
          setLastRefreshed(new Date(cached.cachedAt))
          setServedFromCache(true)
          setLoading(false)
          setError(null)
          // Stagger animation trigger
          setTimeout(() => setReady(true), 50)
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
        setError(null)

        const now = Date.now()
        setLastRefreshed(new Date(now))
        if (forceRefresh) bustCache(userId)
        writeCache(userId, {
          stats: data.stats,
          events: data.recentEvents,
          userName: data.bookerName,
          cachedAt: now,
        })
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err)
        setError(err.message || "Failed to load dashboard data")
      } finally {
        setLoading(false)
        setIsRefreshing(false)
        setTimeout(() => setReady(true), 50)
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

  const handleRefresh = useCallback(() => {
    if (userId) bustCache(userId)
    setReady(false)
    fetchDashboardData(true)
  }, [userId, fetchDashboardData])

  if (loading) return <Preloader isLoading={true} />

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Error banner */}
        {error && (
          <div
            className={`p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 transition-all duration-500 ${
              ready ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            }`}
          >
            <p className="font-semibold text-sm">{error}</p>
            <button onClick={handleRefresh} className="mt-1.5 text-xs underline hover:no-underline">
              Try again
            </button>
          </div>
        )}

        {/* Cache notice */}
        {servedFromCache && lastRefreshed && (
          <div
            className={`flex items-center justify-between text-xs text-slate-400 px-1 transition-all duration-500 delay-75 ${
              ready ? "opacity-100" : "opacity-0"
            }`}
          >
            <span>
              Showing saved data from{" "}
              {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="underline hover:no-underline hover:text-slate-600 transition-colors disabled:opacity-50"
            >
              {isRefreshing ? "Refreshing…" : "Refresh now"}
            </button>
          </div>
        )}

        {/* Header — delay 0 */}
        <div
          className={`transition-all duration-500 ${
            ready ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <DashboardHeader
            userName={userName}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            lastRefreshed={lastRefreshed}
          />
        </div>

        {stats && (
          <>
            {/* Stats — delay 100ms */}
            <div
              className={`transition-all duration-500 delay-100 ${
                ready ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <StatsGrid stats={stats} />
            </div>

            {/* Events — delay 200ms */}
            <div
              className={`transition-all duration-500 delay-200 ${
                ready ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <EventsSection events={events} userId={userId} />
            </div>

            {/* Quick Actions — delay 300ms */}
            <div
              className={`transition-all duration-500 delay-300 ${
                ready ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <QuickActions />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
