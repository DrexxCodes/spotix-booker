"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { Preloader } from "@/components/preloader"
import { ParticlesBackground } from "@/components/particles-background"
import { Nav } from "@/components/nav"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { StatsGrid } from "@/components/dashboard/stats-grid"
import { EventsSection } from "@/components/dashboard/events-section"
import { QuickActions } from "@/components/dashboard/quick-actions"

interface DashboardStats {
  totalEvents: number
  activeEvents: number
  pastEvents: number
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

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [userName, setUserName] = useState("Booker")
  const [error, setError] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login")
        return
      }

      try {
        const userDocRef = doc(db, "users", user.uid)
        const userDoc = await getDoc(userDocRef)

        if (!userDoc.exists()) {
          router.push("/not-a-booker")
          return
        }

        const userData = userDoc.data()
        const isBooker = userData?.role === "booker" || userData?.isBooker === true

        if (!isBooker) {
          router.push("/not-a-booker")
          return
        }

        setUserId(user.uid)
        setAuthChecked(true)
      } catch (err) {
        console.error("Auth check error:", err)
        router.push("/login")
      }
    })

    return () => unsubscribe()
  }, [router])

  const fetchDashboardData = async (forceRefresh = false) => {
    if (!userId) {
      setError("User ID is required")
      setLoading(false)
      return
    }

    try {
      setIsRefreshing(forceRefresh)
      const response = await fetch(`/api/revenue?userId=${userId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch dashboard data")
      }

      setStats(data.stats)
      setEvents(data.recentEvents)
      setUserName(data.bookerName)
      setError(null)
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err)
      setError(err.message || "Failed to load dashboard data")
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (userId) {
      fetchDashboardData()

      const refreshInterval = setInterval(
        () => {
          fetchDashboardData(true)
        },
        2 * 60 * 1000,
      )

      return () => clearInterval(refreshInterval)
    }
  }, [userId])

  const handleRefresh = () => {
    fetchDashboardData(true)
  }

  if (!authChecked) {
    return <Preloader isLoading={true} />
  }

  return (
    <>
      <Preloader isLoading={loading} />
      <ParticlesBackground />

      <div className="min-h-screen bg-background">
        <Nav />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
              <p className="font-medium">{error}</p>
              <button onClick={handleRefresh} className="mt-2 text-sm underline hover:no-underline">
                Try Again
              </button>
            </div>
          )}

          <DashboardHeader userName={userName} onRefresh={handleRefresh} isRefreshing={isRefreshing} />

          {stats && (
            <>
              <StatsGrid stats={stats} />
              <EventsSection events={events} />
              <QuickActions />
            </>
          )}
        </main>
      </div>
    </>
  )
}
