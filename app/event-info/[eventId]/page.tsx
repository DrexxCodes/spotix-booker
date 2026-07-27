// app/event-info/[eventId]/page.tsx
"use client"

import { useMemo, use, useState, useEffect, useRef } from "react"
import type React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { tryRefreshTokens, getAccessToken, authFetch } from "@/lib/auth-client"
import { ArrowLeft, RefreshCw, LogOut, Shield, UserCheck, Calculator, AlertTriangle, Settings, ChevronLeft, ChevronRight, Code2 } from "lucide-react"
import { eventCacheManager } from "@/lib/cache-manger"
import OverviewTab from "@/components/event-info/overview-tab"
import AttendeesTab from "@/components/event-info/attendees-tab"
import DiscountsTab from "@/components/event-info/discounts-tab"
import PayoutsTab from "@/components/event-info/payouts-tab"
import EditEventTab from "@/components/event-info/edit-event-tab"
import MerchTab from "@/components/event-info/merch-tab"
import ReferralsTab from "@/components/event-info/referrals-tab"
import EventLinkTab from "@/components/event-info/event-link-tab"
import FormTab from "@/components/event-info/form-tab"
import ResponsesTab from "@/components/event-info/responses-tab"
import WeatherTab from "@/components/event-info/weather-tab"
import TransferTab from "@/components/event-info/transfer-tab"
import AgentActivityToggle from "@/components/event-info/agent-activity-toggle"
import AgentRequestsTab from "@/components/event-info/agent-requests-tab"
import ApiAccessTab from "@/components/event-info/apiAccess"
import { Suspense } from "react"

// Types 
interface EventData {
  id: string
  eventName: string
  eventImage: string
  eventDate: string
  eventType: string
  eventDescription: string
  isFree: boolean
  ticketPrices: { policy: string; price: number }[]
  allowAgents?: boolean
  agentIncentive?: { type: "percentage" | "flat"; value: number } | null
  createdBy: string
  eventVenue: string
  totalCapacity: number
  ticketsSold: number
  totalRevenue: number
  eventEndDate: string
  eventStart: string
  eventEnd: string
  enableMaxSize: boolean
  maxSize: string
  enableColorCode: boolean
  colorCode: string
  enableStopDate: boolean
  stopDate: string
  payId?: string
  availableRevenue?: number
  totalPaidOut?: number
  status?: string
  votingId?:       string | null
  votingPollName?: string | null
  allowAPIAccess?: boolean
  widgetLength?: number
  widgetHeight?: number
  widgetColour?: string
}

interface AttendeeData {
  id: string; fullName: string; email: string; ticketType: string
  verified: boolean; purchaseDate: string; purchaseTime: string
  ticketReference: string; facialEnroll: "enrolled" | "unenrolled"
  faceEmbedding?: number[] | null
}

interface DiscountData {
  id?: string; code: string; type: "percentage" | "flat"
  value: number; maxUses: number; usedCount: number; active: boolean
}

type CollabRole = "admin" | "checkin" | "accountant" | string

interface CollabInfo {
  collaborationId: string
  role: CollabRole
  ownerId: string
  permissions: string[] | null // null = built-in role; array = custom role tabs
}

// ── Built-in role → allowed tab IDs ───────────────────────────────────────────
const BUILT_IN_ROLE_TABS: Record<string, TabId[]> = {
  admin:      ["overview", "eventlink", "payouts", "attendees", "discounts", "merch", "referrals", "form", "responses", "weather", "transfer", "apiAccess"],
  checkin:    ["attendees", "eventlink", "weather", "form", "responses"],
  accountant: ["overview", "eventlink", "payouts", "discounts", "merch"],
}

// Maps permission IDs (stored in Firestore for custom roles) → TabId
const PERMISSION_TO_TAB: Record<string, TabId> = {
  overview:  "overview",
  attendees: "attendees",
  payouts:   "payouts",
  discounts: "discounts",
  merch:     "merch",
  referrals: "referrals",
  form:      "form",
  responses: "responses",
  weather:   "weather",
  share:     "eventlink",
  transfer:  "transfer",
  apiAccess: "apiAccess",
}

// ── All tabs ───────────────────────────────────────────────────────────────────
const ALL_TABS = [
  "overview", "eventlink", "payouts", "attendees",
  "discounts", "merch", "referrals", "form", "responses",
  "weather", "transfer", "edit", "teams", "agentRequests", "apiAccess",
] as const

type TabId = typeof ALL_TABS[number]

const TAB_LABELS: Record<TabId, string> = {
  overview:  "Overview",   eventlink: "Share Event", attendees: "Attendees",
  discounts: "Discounts",  merch:     "Merch",       referrals: "Referrals",
  form:      "Form",       payouts:   "Payouts",     responses: "Responses",
  weather:   "Weather",    transfer:  "Transfer Event", edit:   "Edit Event",
  teams:     "Teams",      agentRequests: "Agent Requests",
  apiAccess: "API Access",
}

// ── Resolve which tabs a user can see ─────────────────────────────────────────
function resolveVisibleTabs(isOwner: boolean, collab: CollabInfo | null): TabId[] {
  if (isOwner) return [...ALL_TABS] as TabId[]
  if (!collab) return []

  if (collab.role in BUILT_IN_ROLE_TABS) {
    return BUILT_IN_ROLE_TABS[collab.role]
  }

  if (Array.isArray(collab.permissions) && collab.permissions.length > 0) {
    return collab.permissions
      .map((p) => PERMISSION_TO_TAB[p.toLowerCase()])
      .filter((t): t is TabId => Boolean(t))
  }

  return []
}

// ── Role badge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const built: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    admin:      { label: "Admin",      cls: "bg-rose-50 text-rose-700 border-rose-200",       icon: <Shield size={12} /> },
    checkin:    { label: "Check-in",   cls: "bg-blue-50 text-blue-700 border-blue-200",       icon: <UserCheck size={12} /> },
    accountant: { label: "Accountant", cls: "bg-purple-50 text-purple-700 border-purple-200", icon: <Calculator size={12} /> },
  }
  const c = built[role] ?? { label: role, cls: "bg-slate-50 text-slate-700 border-slate-200", icon: <Settings size={12} /> }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  )
}

// ── Exit dialog ────────────────────────────────────────────────────────────────
function ExitTeamDialog({ eventName, onConfirm, onCancel, loading }: {
  eventName: string; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Exit Team</h3>
            <p className="text-sm text-slate-500">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          You&apos;ll lose access to <span className="font-semibold">{eventName}</span>. The owner will need to re-add you.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <LogOut size={15} />}
            Exit Team
          </button>
        </div>
      </div>
    </div>
  )
}

function TabSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-32 bg-slate-200 rounded-lg" />
      <div className="h-24 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-lg" />)}
      </div>
    </div>
  )
}

// ── Inner page (needs useSearchParams) ────────────────────────────────────────
function EventInfoInner({ eventId }: { eventId: string }) {
  const router       = useRouter()
  // useSearchParams is used implicitly by Next.js — keep Suspense wrapper above
  useSearchParams()

  const [pageReady, setPageReady]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const [refreshing, setRefreshing]     = useState(false)
  // uid from /api/user/me — the single source of truth, no Firebase dependency
  const [currentUid, setCurrentUid]     = useState<string>("")
  const [eventData, setEventData]       = useState<EventData | null>(null)
  const [attendees, setAttendees]       = useState<AttendeeData[]>([])
  const [discounts, setDiscounts]       = useState<DiscountData[]>([])
  const [payouts, setPayouts]           = useState<any[]>([])
  const [bookerBVT, setBookerBVT]       = useState("")
  const [ticketSalesByDay, setTicketSalesByDay] = useState<any[]>([])
  const [ticketSalesByType, setTicketSalesByType] = useState<any[]>([])
  const [availableBalance, setAvailableBalance]   = useState(0)
  const [totalPaidOut, setTotalPaidOut]   = useState(0)
  const [editFormData, setEditFormData]   = useState<any>(null)
  const [copiedField, setCopiedField]     = useState<string | null>(null)
  const [cacheInfo, setCacheInfo]         = useState<{ isCached: boolean; remainingTime: number | null }>({ isCached: false, remainingTime: null })
  const [activeTab, setActiveTab]         = useState<TabId>("overview")
  const [loadedTabs, setLoadedTabs]       = useState<Set<string>>(new Set(["overview"]))
  const [newDiscount, setNewDiscount]     = useState<DiscountData>({ code: "", type: "percentage", value: 0, maxUses: 1, usedCount: 0, active: true })

  const [isOwner, setIsOwner]             = useState(false)
  const [collabInfo, setCollabInfo]       = useState<CollabInfo | null>(null)
  const [exitDialog, setExitDialog]       = useState(false)
  const [exitLoading, setExitLoading]     = useState(false)

  const visibleTabs = useMemo(
    () => resolveVisibleTabs(isOwner, collabInfo),
    [isOwner, collabInfo]
  )

  const ticketTypeData = useMemo(() => {
    if (!eventData || !attendees.length) return []
    const tc: Record<string, number> = {}
    attendees.forEach((a) => { tc[a.ticketType] = (tc[a.ticketType] || 0) + 1 })
    return Object.keys(tc).map((type) => ({ type, count: tc[type] }))
  }, [eventData, attendees])

  const handleTabSwitch = (tab: TabId) => {
    if (!visibleTabs.includes(tab)) return
    setActiveTab(tab)
    setLoadedTabs((prev) => new Set([...Array.from(prev), tab]))
  }

  const tabStripRef = useRef<HTMLDivElement>(null)
  const scrollTabs = (direction: "left" | "right") => {
    const el = tabStripRef.current
    if (!el) return
    el.scrollBy({ left: direction === "left" ? -160 : 160, behavior: "smooth" })
  }

  function populateEventData(data: any) {
    setEventData(data.eventData ?? null)
    setBookerBVT(data.bookerBVT ?? "")
    setAttendees(data.attendees ?? [])
    setDiscounts(data.discounts ?? [])
    setPayouts(data.payouts ?? [])
    setTicketSalesByDay(data.ticketSalesByDay ?? [])
    setTicketSalesByType(data.ticketSalesByType ?? [])
    setAvailableBalance(data.availableBalance ?? 0)
    setTotalPaidOut(data.totalPaidOut ?? 0)
    if (data.eventData) {
      setEditFormData({ ...data.eventData, enablePricing: !data.eventData.isFree })
    }
  }

  // ── Step 2: collaboration check ───────────────────────────────────────────
  async function loadCollabAccess(uid: string) {
    console.log("[EventInfo] loadCollabAccess — uid:", uid, "eventId:", eventId)
    try {
      const res = await authFetch(`/api/teams?eventId=${eventId}&action=myAccess`)
      console.log("[EventInfo] myAccess status:", res.status)

      if (!res.ok) {
        console.warn("[EventInfo] myAccess failed:", res.status)
        return
      }

      const data = await res.json()
      console.log("[EventInfo] myAccess response — role:", data.collaboration?.role, "hasEventData:", !!data.eventData)

      if (!data.collaboration || !data.eventData) {
        console.warn("[EventInfo] myAccess: missing collaboration or eventData in response")
        return
      }

      const role: string = data.collaboration.role
      const permissions: string[] | null = data.collaboration.permissions ?? null

      // Resolve default tab for this role
      let defaultTab: TabId = "overview"
      if (role in BUILT_IN_ROLE_TABS) {
        defaultTab = BUILT_IN_ROLE_TABS[role][0]
      } else if (Array.isArray(permissions) && permissions.length > 0) {
        const first = PERMISSION_TO_TAB[permissions[0]?.toLowerCase()]
        if (first) defaultTab = first
      }

      setCollabInfo({
        collaborationId: data.collaboration.collaborationId,
        role,
        ownerId: data.collaboration.ownerId,
        permissions,
      })

      populateEventData({
        eventData:        data.eventData,
        attendees:        data.attendees ?? [],
        discounts:        [],
        payouts:          [],
        ticketSalesByDay: [],
        ticketSalesByType: [],
        availableBalance: 0,
        totalPaidOut:     0,
      })

      setActiveTab(defaultTab)
      setLoadedTabs(new Set([defaultTab]))

    } catch (err) {
      console.error("[EventInfo] loadCollabAccess error:", err)
    }
  }

  // ── Main load function ─────────────────────────────────────────────────────
  async function loadPage(uid: string, forceRefresh = false) {
    console.log("[EventInfo] loadPage — uid:", uid, "eventId:", eventId, "forceRefresh:", forceRefresh)

    try {
      // ── Try cache (owner path only) ─────────────────────────────────────
      if (!forceRefresh) {
        const cached = eventCacheManager.get<any>(`event_${eventId}`)
        if (cached) {
          const ownerId = cached.eventData?.createdBy
          if (uid === ownerId) {
            console.log("[EventInfo] Cache hit — confirmed owner")
            populateEventData(cached)
            setIsOwner(true)
            const rem = eventCacheManager.getRemainingTime(`event_${eventId}`)
            setCacheInfo({ isCached: true, remainingTime: rem })
            setPageReady(true)
            return
          }
          console.log("[EventInfo] Cache belongs to different owner, skipping")
        }
      } else {
        eventCacheManager.invalidate(`event_${eventId}`)
        setRefreshing(true)
      }

      // ── Step 1: attempt owner fetch ─────────────────────────────────────
      console.log("[EventInfo] Fetching owner data from /api/event/list/" + eventId)
      const ownerRes = await authFetch(`/api/event/list/${eventId}`)
      console.log("[EventInfo] Owner fetch status:", ownerRes.status)

      if (ownerRes.ok) {
        const data = await ownerRes.json()
        console.log("[EventInfo] Owner fetch success — eventName:", data.eventData?.eventName)
        eventCacheManager.set(`event_${eventId}`, data)
        populateEventData(data)
        setIsOwner(true)
        setCacheInfo({ isCached: false, remainingTime: null })
        setPageReady(true)
        return
      }

      // ── Step 2: not the owner — check collaborations ────────────────────
      console.log("[EventInfo] Not owner (status " + ownerRes.status + "), checking collaboration...")
      await loadCollabAccess(uid)

    } catch (err) {
      console.error("[EventInfo] loadPage error:", err)
    } finally {
      setRefreshing(false)
      setPageReady(true)
    }
  }

  // ── Auth bootstrap — /api/user/me only, no Firebase ───────────────────────
  useEffect(() => {
    console.log("[EventInfo] useEffect — bootstrapping auth, eventId:", eventId)

    async function bootstrap() {
      try {
        // Ensure we have a valid access token first
        let token = getAccessToken()
        if (!token) {
          console.log("[EventInfo] No token, attempting refresh...")
          const ok = await tryRefreshTokens()
          if (!ok) {
            console.warn("[EventInfo] Refresh failed — redirecting to login")
            router.push("/login")
            return
          }
          console.log("[EventInfo] Token refreshed")
        }

        // Resolve the logged-in uid the same way every other page does
        const meRes = await authFetch("/api/user/me")
        if (!meRes.ok) {
          console.warn("[EventInfo] /api/user/me failed:", meRes.status, "— redirecting to login")
          router.push("/login")
          return
        }

        const me = await meRes.json()
        const uid: string = me.uid ?? me.userId ?? me.id ?? ""
        if (!uid) {
          console.warn("[EventInfo] /api/user/me returned no uid — redirecting to login")
          router.push("/login")
          return
        }

        console.log("[EventInfo] Resolved uid from /api/user/me:", uid)
        setCurrentUid(uid)
        await loadPage(uid)
      } catch (err) {
        console.error("[EventInfo] bootstrap error:", err)
        router.push("/login")
      }
    }

    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  // ── Refresh — uses the uid already stored in state ─────────────────────────
  const handleRefreshData = () => {
    if (currentUid) loadPage(currentUid, true)
  }

  // ── Clipboard ──────────────────────────────────────────────────────────────
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // ── Discounts ──────────────────────────────────────────────────────────────
  const handleDiscountInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setNewDiscount((prev) => ({ ...prev, [name]: type === "number" ? Number(value) : value }))
  }

  const handleAddDiscount = async () => {
    if (!newDiscount.code.trim()) { alert("Please enter a discount code."); return }
    setSaving(true)
    try {
      const res  = await authFetch(`/api/event/list/${eventId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "addDiscount", ...newDiscount }) })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? "Failed to add discount."); return }
      setDiscounts((prev) => [...prev, data.discount])
      setNewDiscount({ code: "", type: "percentage", value: 0, maxUses: 1, usedCount: 0, active: true })
      alert("Discount code added successfully!")
    } catch { alert("Failed to add discount code.") }
    finally { setSaving(false) }
  }

  const handleToggleDiscountStatus = async (index: number) => {
    const target = discounts[index]
    if (!target.id) return
    setSaving(true)
    try {
      const res  = await authFetch(`/api/event/list/${eventId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggleDiscount", discountId: target.id }) })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? "Failed."); return }
      setDiscounts((prev) => prev.map((d, i) => i === index ? { ...d, active: data.active } : d))
    } catch { alert("Failed.") }
    finally { setSaving(false) }
  }

  // ── Edit event ─────────────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === "checkbox") setEditFormData((p: any) => ({ ...p, [name]: (e.target as HTMLInputElement).checked }))
    else setEditFormData((p: any) => ({ ...p, [name]: value }))
  }

  const handleTicketPriceChange = (index: number, field: string, value: string) => {
    const updated = [...editFormData.ticketPrices]
    updated[index][field as "policy" | "price"] = field === "price" ? Number(value) : value
    setEditFormData((p: any) => ({ ...p, ticketPrices: updated }))
  }

  const addTicketPrice = () => setEditFormData((p: any) => ({ ...p, ticketPrices: [...p.ticketPrices, { policy: "", price: 0 }] }))

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res  = await authFetch(`/api/event/list/${eventId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", ...editFormData }) })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? "Failed to update event."); return }
      setEventData((prev) => prev ? { ...prev, eventName: editFormData.eventName, eventDescription: editFormData.eventDescription, eventDate: editFormData.eventDate, eventEndDate: editFormData.eventEndDate, eventVenue: editFormData.eventVenue, eventStart: editFormData.eventStart, eventEnd: editFormData.eventEnd, eventType: editFormData.eventType, isFree: !editFormData.enablePricing, ticketPrices: editFormData.enablePricing ? editFormData.ticketPrices : [], enableStopDate: editFormData.enableStopDate, stopDate: editFormData.enableStopDate ? editFormData.stopDate : "", enableColorCode: editFormData.enableColorCode, colorCode: editFormData.enableColorCode ? editFormData.colorCode : "", enableMaxSize: editFormData.enableMaxSize, maxSize: editFormData.enableMaxSize ? editFormData.maxSize : "" } : prev)
      alert("Event updated successfully!")
      handleTabSwitch("overview")
    } catch { alert("Failed to update event.") }
    finally { setSaving(false) }
  }

  // ── Exit team ──────────────────────────────────────────────────────────────
  async function handleExitTeam() {
    if (!collabInfo) return
    setExitLoading(true)
    try {
      const res = await authFetch("/api/teams", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collaborationId: collabInfo.collaborationId }) })
      if (res.ok) { router.push("/events"); return }
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? "Failed to exit team.")
    } catch { alert("Network error.") }
    finally { setExitLoading(false); setExitDialog(false) }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!pageReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-6xl mx-auto animate-pulse">
          <div className="h-10 w-40 bg-slate-200 rounded mb-8" />
          <div className="h-64 w-full bg-slate-200 rounded-lg mb-6" />
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!eventData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-6xl mx-auto">
          <Link href="/events"><button className="flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 mb-4"><ArrowLeft size={18} /> Back to Events</button></Link>
          <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
            <p className="text-slate-600">Event not found or you don&apos;t have access to this event.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Tab icons ──────────────────────────────────────────────────────────────
  // (imported inline to avoid touching the import block above)
  const TAB_ICONS: Record<TabId, React.ReactNode> = {
    overview: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>,
    eventlink: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
    payouts: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>,
    attendees: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    discounts: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="m15 10 5 5-5 5" /><line x1="4" x2="20" y1="9" y2="9" /><line x1="4" x2="20" y1="19" y2="19" /></svg>,
    merch: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" x2="21" y1="6" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
    referrals: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8" /><line x1="4" x2="21" y1="20" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" x2="21" y1="15" y2="21" /></svg>,
    form: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
    responses: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    weather: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg>,
    transfer: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></svg>,
    edit: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
    teams: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    agentRequests: undefined,
    apiAccess: <Code2 size={14} />,
  }

  const eventDate = new Date(eventData.eventDate)
  const isPast    = eventDate < new Date()
  const statusColor = {
    active:    "bg-emerald-100 text-emerald-700 border-emerald-200",
    inactive:  "bg-amber-100 text-amber-700 border-amber-200",
    cancelled: "bg-rose-100 text-rose-700 border-rose-200",
    completed: "bg-blue-100 text-blue-700 border-blue-200",
    past:      "bg-slate-100 text-slate-600 border-slate-200",
  }[eventData.status ?? (isPast ? "past" : "active")] ?? "bg-slate-100 text-slate-600 border-slate-200"

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {exitDialog && (
        <ExitTeamDialog
          eventName={eventData.eventName}
          onConfirm={handleExitTeam}
          onCancel={() => setExitDialog(false)}
          loading={exitLoading}
        />
      )}

      {/* ── Scrollable page header (back bar + event name/meta) ─────────── */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Top row: back + actions */}
          <div className="flex items-center justify-between h-12">
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft size={15} strokeWidth={2} />
              Events
            </Link>

            <div className="flex items-center gap-2">
              {collabInfo && (
                <>
                  <RoleBadge role={collabInfo.role} />
                  <button
                    onClick={() => setExitDialog(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={13} /> Exit Team
                  </button>
                </>
              )}
              {isOwner && (
                <>
                  {cacheInfo.isCached && cacheInfo.remainingTime !== null && (
                    <span className="hidden sm:inline text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                      Cached · {Math.ceil(cacheInfo.remainingTime / 1000)}s
                    </span>
                  )}
                  <button
                    onClick={handleRefreshData}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Refreshing…" : "Refresh"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Event name + meta row — scrolls away with the page */}
          <div className="pb-4 pt-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight truncate max-w-[600px]">
                    {eventData.eventName}
                  </h1>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor}`}>
                    {(eventData.status ?? (isPast ? "past" : "active")).charAt(0).toUpperCase() +
                      (eventData.status ?? (isPast ? "past" : "active")).slice(1)}
                  </span>
                </div>
                <p className="text-sm text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    {eventData.eventVenue}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                    {eventDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  {eventData.eventType && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>{eventData.eventType}</span>
                    </>
                  )}
                </p>
              </div>

              {/* Key stats pill row */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="hidden sm:flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 leading-none mb-0.5">Sold</p>
                    <p className="text-sm font-bold text-slate-900 leading-none">{eventData.ticketsSold.toLocaleString()}</p>
                  </div>
                  {eventData.enableMaxSize && eventData.totalCapacity > 0 && (
                    <>
                      <div className="w-px h-6 bg-slate-200" />
                      <div className="text-center">
                        <p className="text-xs text-slate-400 leading-none mb-0.5">Capacity</p>
                        <p className="text-sm font-bold text-slate-900 leading-none">{eventData.totalCapacity.toLocaleString()}</p>
                      </div>
                    </>
                  )}
                  <div className="w-px h-6 bg-slate-200" />
                  <div className="text-center">
                    <p className="text-xs text-slate-400 leading-none mb-0.5">Revenue</p>
                    <p className="text-sm font-bold text-[#6b2fa5] leading-none">
                      ₦{eventData.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky tab strip — sticks right under the nav (top-14) ─────── */}
      <div className="sticky top-14 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => scrollTabs("left")}
              aria-label="Scroll tabs left"
              className="shrink-0 z-10 flex items-center justify-center w-7 h-7 -ml-1 mr-1 rounded-full bg-white border border-slate-200 text-slate-500 shadow-sm hover:text-[#6b2fa5] hover:border-[#6b2fa5]/40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={tabStripRef}
              className="flex overflow-x-auto gap-0 -mb-px scrollbar-none [&::-webkit-scrollbar]:hidden scroll-smooth"
            >
              {visibleTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabSwitch(tab)}
                  className={`
                    inline-flex items-center gap-1.5 px-3.5 py-2.5
                    text-xs font-semibold whitespace-nowrap border-b-2
                    transition-all duration-150 flex-shrink-0
                    ${activeTab === tab
                      ? "border-[#6b2fa5] text-[#6b2fa5] bg-[#6b2fa5]/[0.04]"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    }
                  `}
                >
                  <span className={activeTab === tab ? "text-[#6b2fa5]" : "text-slate-400"}>
                    {TAB_ICONS[tab]}
                  </span>
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollTabs("right")}
              aria-label="Scroll tabs right"
              className="shrink-0 z-10 flex items-center justify-center w-7 h-7 -mr-1 ml-1 rounded-full bg-white border border-slate-200 text-slate-500 shadow-sm hover:text-[#6b2fa5] hover:border-[#6b2fa5]/40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6">

            {activeTab === "overview" && visibleTabs.includes("overview") && (
              loadedTabs.has("overview") && eventData
                ? <OverviewTab eventData={eventData} availableBalance={availableBalance} totalPaidOut={totalPaidOut} copiedField={copiedField} bookerBVT={bookerBVT} ticketSalesByDay={ticketSalesByDay} ticketTypeData={ticketTypeData} copyToClipboard={copyToClipboard} />
                : <TabSkeleton />
            )}

            {activeTab === "eventlink" && visibleTabs.includes("eventlink") && (
              loadedTabs.has("eventlink") && eventData ? <EventLinkTab eventId={eventData.id} /> : <TabSkeleton />
            )}

            {activeTab === "attendees" && visibleTabs.includes("attendees") && (
              loadedTabs.has("attendees")
                ? <AttendeesTab attendees={attendees} formatFirestoreTimestamp={(ts: any) => ts} eventId={eventId} eventName={eventData.eventName} />
                : <TabSkeleton />
            )}

            {activeTab === "discounts" && visibleTabs.includes("discounts") && (
              loadedTabs.has("discounts")
                ? <DiscountsTab discounts={discounts} newDiscount={newDiscount} handleDiscountInputChange={handleDiscountInputChange} handleAddDiscount={handleAddDiscount} handleToggleDiscountStatus={handleToggleDiscountStatus} />
                : <TabSkeleton />
            )}

            {activeTab === "merch" && visibleTabs.includes("merch") && (
              loadedTabs.has("merch") && currentUid && eventData
                ? <MerchTab eventId={eventId} eventName={eventData.eventName} currentUserId={currentUid} />
                : <TabSkeleton />
            )}

            {activeTab === "referrals" && visibleTabs.includes("referrals") && (
              loadedTabs.has("referrals") ? <ReferralsTab eventId={eventId} /> : <TabSkeleton />
            )}

            {activeTab === "form" && visibleTabs.includes("form") && (
              loadedTabs.has("form") && eventData
                ? <FormTab userId={currentUid} eventId={eventId} ticketTypes={eventData.ticketPrices ?? []} />
                : <TabSkeleton />
            )}

            {activeTab === "responses" && visibleTabs.includes("responses") && (
              loadedTabs.has("responses") ? <ResponsesTab userId={currentUid} eventId={eventId} /> : <TabSkeleton />
            )}

            {activeTab === "payouts" && visibleTabs.includes("payouts") && (
              loadedTabs.has("payouts") && eventData
                ? <PayoutsTab availableBalance={availableBalance} eventData={eventData} userId={currentUid} eventId={eventId} currentUserId={currentUid} attendees={attendees} payId={eventData.payId ?? ""} />
                : <TabSkeleton />
            )}

            {activeTab === "weather" && visibleTabs.includes("weather") && (
              <WeatherTab eventId={eventId} />
            )}

            {activeTab === "transfer" && visibleTabs.includes("transfer") && (
              loadedTabs.has("transfer") && eventData
                ? <TransferTab eventId={eventId} organizerId={eventData.createdBy ?? ""} currentUserId={currentUid} eventName={""} />
                : <TabSkeleton />
            )}

            {activeTab === "edit" && visibleTabs.includes("edit") && (
              loadedTabs.has("edit") && editFormData
                ? <EditEventTab editFormData={editFormData} handleInputChange={handleInputChange} handleTicketPriceChange={handleTicketPriceChange} addTicketPrice={addTicketPrice} handleSubmitEdit={handleSubmitEdit} setEditFormData={setEditFormData} userId={currentUid} eventId={eventId} />
                : <TabSkeleton />
            )}

            {activeTab === "teams" && visibleTabs.includes("teams") && (
              <div className="space-y-5">
                <AgentActivityToggle
                  eventId={eventId}
                  initialValue={eventData?.allowAgents ?? false}
                  initialIncentive={eventData?.agentIncentive ?? null}
                />

                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#6b2fa5]/8 flex items-center justify-center">
                    <Shield size={26} className="text-[#6b2fa5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 mb-1">Team Management</h3>
                    <p className="text-sm text-slate-500 max-w-xs">Add collaborators, assign roles, and manage who can access this event.</p>
                  </div>
                  <Link href={`/teams?eventId=${eventId}`}>
                    <button className="px-5 py-2.5 bg-[#6b2fa5] text-white text-sm rounded-xl font-semibold hover:bg-[#5a2589] transition-colors shadow-sm shadow-[#6b2fa5]/20">
                      Manage Team
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {activeTab === "agentRequests" && visibleTabs.includes("agentRequests") && (
              <AgentRequestsTab
                eventId={eventId}
                isFree={eventData?.isFree ?? false}
                ticketPrices={eventData?.ticketPrices ?? []}
                agentIncentive={eventData?.agentIncentive ?? null}
              />
            )}

            {activeTab === "apiAccess" && visibleTabs.includes("apiAccess") && (
              loadedTabs.has("apiAccess") && eventData
                ? <ApiAccessTab
                    eventId={eventId}
                    allowAPIAccess={eventData.allowAPIAccess ?? false}
                    widgetLength={eventData.widgetLength}
                    widgetHeight={eventData.widgetHeight}
                    widgetColour={eventData.widgetColour}
                  />
                : <TabSkeleton />
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page export — unwrap params + Suspense for useSearchParams ─────────────────
export default function EventInfoPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-6xl mx-auto animate-pulse">
          <div className="h-10 w-40 bg-slate-200 rounded mb-8" />
          <div className="h-64 w-full bg-slate-200 rounded-lg mb-6" />
        </div>
      </div>
    }>
      <EventInfoInner eventId={eventId} />
    </Suspense>
  )
}
