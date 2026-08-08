"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import {
  ArrowLeft,
  Link2,
  Link2Off,
  CalendarDays,
  Loader,
  AlertTriangle,
  CheckCircle,
  Search,
} from "lucide-react"
import PollTeamPanel from "./components/PollTeamPanel"
import TieBreakerPanel from "./components/TieBreakerPanel"

interface EventOption {
  id: string
  eventName: string
  eventDate: string
  eventVenue: string
  status: string
}

interface PollLinkInfo {
  pollId: string
  pollName:        string
  linkedEventId:   string | null
  linkedEventName: string | null
}

export default function PollSettingsPage() {
  const router  = useRouter()
  const params  = useParams()
  const pollId  = params.pollId as string

  const [authChecked, setAuthChecked] = useState(false)
  const [linkInfo,    setLinkInfo]    = useState<PollLinkInfo | null>(null)
  const [events,      setEvents]      = useState<EventOption[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [successMsg,  setSuccessMsg]  = useState<string | null>(null)
  const [selected,    setSelected]    = useState<string>("")
  const [search,      setSearch]      = useState("")

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      let token = getAccessToken()
      if (!token) {
        const refreshed = await tryRefreshTokens()
        if (refreshed) token = getAccessToken()
      }
      if (!token) { router.replace("/login"); return }
      setAuthChecked(true)
    })()
  }, [router])

  // ── Load link info + events ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!authChecked) return
    setLoading(true)
    setError(null)
    try {
      const [linkRes, eventsRes] = await Promise.all([
        authFetch(`/api/polls/settings?pollId=${pollId}`),
        authFetch("/api/event/list?action=owned"),
      ])

      // Poll Settings is creator-only — a poll team member gets 403 here
      // (see app/api/polls/settings/route.ts). Bounce them out instead of
      // rendering a settings shell they have no business seeing; they
      // still have full access to the Edit page.
      if (linkRes.status === 403) { router.replace("/polls"); return }
      if (!linkRes.ok) throw new Error("Failed to load poll settings")
      if (!eventsRes.ok) throw new Error("Failed to load events")

      const linkJson   = await linkRes.json()
      const eventsJson = await eventsRes.json()

      setLinkInfo(linkJson)
      setEvents(eventsJson.events ?? [])
      if (linkJson.linkedEventId) setSelected(linkJson.linkedEventId)
    } catch (e: any) {
      setError(e.message ?? "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [authChecked, pollId])

  useEffect(() => { load() }, [load])

  // ── Link ────────────────────────────────────────────────────────────────────
  const handleLink = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await authFetch("/api/polls/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, eventId: selected, action: "link" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Link failed")
      setLinkInfo((prev) => prev ? { ...prev, linkedEventId: json.linkedEventId, linkedEventName: json.linkedEventName } : prev)
      setSuccessMsg(`Poll linked to "${json.linkedEventName}" successfully.`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Unlink ──────────────────────────────────────────────────────────────────
  const handleUnlink = async () => {
    if (!confirm("Unlink this poll from the event?")) return
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await authFetch("/api/polls/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, action: "unlink" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Unlink failed")
      setLinkInfo((prev) => prev ? { ...prev, linkedEventId: null, linkedEventName: null } : prev)
      setSelected("")
      setSuccessMsg("Poll unlinked from event.")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredEvents = events.filter((e) =>
    e.eventName.toLowerCase().includes(search.toLowerCase()) ||
    e.eventVenue.toLowerCase().includes(search.toLowerCase())
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader className="w-8 h-8 animate-spin text-[#6b2fa5]" />
      </div>
    )
  }

  const isLinked   = Boolean(linkInfo?.linkedEventId)
  const linkedName = linkInfo?.linkedEventName ?? ""

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center gap-3">
        <Link
          href={`/polls/${pollId}`}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Poll Settings</h1>
          <p className="text-sm text-slate-500 font-medium">{linkInfo?.pollName || pollId}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Feedback banners */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{successMsg}</p>
          </div>
        )}

        {/* Current linkage card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Linked Event
          </h2>

          {isLinked ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#6b2fa5]/10 flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-5 h-5 text-[#6b2fa5]" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{linkedName}</p>
                  <p className="text-xs text-slate-400 font-mono">{linkInfo?.linkedEventId}</p>
                </div>
              </div>
              <button
                onClick={handleUnlink}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Link2Off className="w-4 h-4" />}
                Unlink
              </button>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No event linked yet.</p>
          )}
        </div>

        {/* Affiliate to event */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Affiliate to an Event
          </h2>
          <p className="text-xs text-slate-400 mb-5">
            Linking a poll to an event shows poll details in the event overview and allows attendees to discover the poll from the event page.
            {isLinked && " Unlink the current event above before linking a new one."}
          </p>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20"
            />
          </div>

          {/* Event list */}
          <div className="space-y-2 max-h-72 overflow-y-auto mb-5">
            {filteredEvents.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No events found.</p>
            ) : (
              filteredEvents.map((ev) => (
                <label
                  key={ev.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selected === ev.id
                      ? "border-[#6b2fa5] bg-[#6b2fa5]/5"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="event"
                    value={ev.id}
                    checked={selected === ev.id}
                    onChange={() => setSelected(ev.id)}
                    className="accent-[#6b2fa5]"
                  />
                  <CalendarDays className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{ev.eventName}</p>
                    <p className="text-xs text-slate-400 truncate">{ev.eventVenue} · {new Date(ev.eventDate).toLocaleDateString("en-NG", { dateStyle: "medium" })}</p>
                  </div>
                  {ev.id === linkInfo?.linkedEventId && (
                    <span className="text-xs bg-[#6b2fa5]/10 text-[#6b2fa5] px-2 py-0.5 rounded-full font-medium flex-shrink-0">Linked</span>
                  )}
                </label>
              ))
            )}
          </div>

          <button
            onClick={handleLink}
            disabled={!selected || saving || isLinked}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#6b2fa5] hover:bg-[#5a1f8a] text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {isLinked ? "Already Linked — Unlink First" : "Link to Selected Event"}
          </button>
        </div>

        {/* Tie-Breaker — resolves ties instead of crowning a winner by array order */}
        <TieBreakerPanel pollId={pollId} />

        {/* Poll Team — creator-only, imported per poll settings page */}
        <PollTeamPanel pollId={pollId} />
      </div>
    </div>
  )
}
