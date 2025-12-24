"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, collection, getDocs } from "firebase/firestore"
import { Nav } from "@/components/nav"
import { Preloader } from "@/components/preloader"
import { ParticlesBackground } from "@/components/particles-background"
import { EventsList } from "@/components/events/events-list"
import { CollaboratedEventsList } from "@/components/events/collaborated-events-list"
import { Search, Plus, Calendar, TrendingUp, Users } from "lucide-react"

interface EventData {
  id: string
  eventName: string
  eventDate: string
  eventType: string
  isFree: boolean
  ticketsSold: number
  totalCapacity: number
  revenue: number
  status: "active" | "past" | "draft"
  eventVenue: string
  hasMaxSize: boolean
}

interface CollaboratedEventData extends EventData {
  ownerId: string
  role: string
}

export default function EventsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [events, setEvents] = useState<EventData[]>([])
  const [collaboratedEvents, setCollaboratedEvents] = useState<CollaboratedEventData[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

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

  useEffect(() => {
    if (!userId) return

    const fetchEvents = async () => {
      try {
        // Fetch user's events
        const eventsCollectionRef = collection(db, "events", userId, "userEvents")
        const eventsSnapshot = await getDocs(eventsCollectionRef)

        const eventsData: EventData[] = []
        eventsSnapshot.forEach((doc) => {
          const data = doc.data()
          const eventDate = new Date(data.eventDate)
          const isPast = eventDate < new Date()

          eventsData.push({
            id: doc.id,
            eventName: data.eventName || "Unnamed Event",
            eventDate: data.eventDate || new Date().toISOString(),
            eventType: data.eventType || "Other",
            isFree: data.isFree || false,
            ticketsSold: data.ticketsSold || 0,
            totalCapacity: data.enableMaxSize ? Number.parseInt(data.maxSize) : 100,
            revenue: data.totalRevenue || 0,
            status: isPast ? "past" : "active",
            eventVenue: data.eventVenue || "No venue specified",
            hasMaxSize: data.enableMaxSize || false,
          })
        })

        setEvents(eventsData)

        // Fetch collaborated events
        const collaborationsDocRef = doc(db, "collaborations", userId)
        const collaborationsDoc = await getDoc(collaborationsDocRef)

        if (collaborationsDoc.exists()) {
          const collaborations = collaborationsDoc.data().events || []
          const collaboratedEventsData: CollaboratedEventData[] = []

          for (const collaboration of collaborations) {
            try {
              const eventDocRef = doc(db, "events", collaboration.ownerId, "userEvents", collaboration.eventId)
              const eventDoc = await getDoc(eventDocRef)

              if (eventDoc.exists()) {
                const data = eventDoc.data()
                if (data.enabledCollaboration !== true) continue

                const eventDate = new Date(data.eventDate)
                const isPast = eventDate < new Date()

                collaboratedEventsData.push({
                  id: eventDoc.id,
                  eventName: data.eventName || "Unnamed Event",
                  eventDate: data.eventDate || new Date().toISOString(),
                  eventType: data.eventType || "Other",
                  isFree: data.isFree || false,
                  ticketsSold: data.ticketsSold || 0,
                  totalCapacity: data.enableMaxSize ? Number.parseInt(data.maxSize) : 100,
                  revenue: data.totalRevenue || 0,
                  status: isPast ? "past" : "active",
                  eventVenue: data.eventVenue || "No venue specified",
                  hasMaxSize: data.enableMaxSize || false,
                  ownerId: collaboration.ownerId,
                  role: collaboration.role || "viewer",
                })
              }
            } catch (error) {
              console.error("Error fetching collaborated event:", error)
            }
          }

          setCollaboratedEvents(collaboratedEventsData)
        }
      } catch (error) {
        console.error("Error fetching events:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [userId])

  // Calculate stats
  const totalEvents = events.length
  const activeEvents = events.filter((e) => e.status === "active").length
  const totalRevenue = events.reduce((sum, e) => sum + e.revenue, 0)
  const totalTicketsSold = events.reduce((sum, e) => sum + e.ticketsSold, 0)

  if (!authChecked) {
    return <Preloader isLoading={true} />
  }

  return (
    <>
      <Preloader isLoading={loading} />
      <ParticlesBackground />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/20 to-gray-100">
        <Nav />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {/* Header */}
          <div className="mb-8 sm:mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-[#6b2fa5] via-[#8b3fc5] to-[#6b2fa5] bg-clip-text text-transparent">
                  My Events
                </h1>
                <p className="text-gray-600 text-base sm:text-lg">Manage and track all your events in one place</p>
              </div>
              <button
                onClick={() => router.push("/create-event")}
                className="bg-gradient-to-r from-[#6b2fa5] to-[#8b3fc5] hover:from-[#5a2789] hover:to-[#6b2fa5] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-[#6b2fa5]/30 hover:shadow-xl hover:shadow-[#6b2fa5]/40 hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus size={22} strokeWidth={2.5} />
                <span>Create Event</span>
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 animate-in fade-in slide-in-from-top-6 duration-700">
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow duration-200 border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Total Events</p>
                  <p className="text-3xl font-bold text-gray-900">{totalEvents}</p>
                </div>
                <div className="w-12 h-12 bg-[#6b2fa5]/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-[#6b2fa5]" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow duration-200 border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Active Events</p>
                  <p className="text-3xl font-bold text-green-600">{activeEvents}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow duration-200 border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Tickets Sold</p>
                  <p className="text-3xl font-bold text-blue-600">{totalTicketsSold}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow duration-200 border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold text-[#6b2fa5]">₦{totalRevenue.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-[#6b2fa5]/10 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#6b2fa5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="mb-8 flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search events by name, type, or venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 shadow-sm hover:shadow-md"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-5 py-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 shadow-sm hover:shadow-md font-medium text-gray-700 cursor-pointer"
            >
              <option value="all">All Events</option>
              <option value="active">Active Events</option>
              <option value="past">Past Events</option>
            </select>
          </div>

          {/* My Events Section */}
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <EventsList events={events} searchQuery={searchQuery} statusFilter={statusFilter} userId={userId || ""} />
          </div>

          {/* Collaborated Events Section */}
          {collaboratedEvents.length > 0 && (
            <div className="mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <CollaboratedEventsList
                events={collaboratedEvents}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
              />
            </div>
          )}
        </main>
      </div>
    </>
  )
}
