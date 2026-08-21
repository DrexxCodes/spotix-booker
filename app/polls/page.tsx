"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import { toContestantArray, contestantCount, type ContestantsField } from "@/lib/contestants"
import {
  Loader, Plus, Vote, TrendingUp, Clock, CheckCircle,
  XCircle, BarChart2, AlertTriangle, RefreshCw, Shuffle, Settings2,
  ListChecks, Copy, Users,
} from "lucide-react"

interface Contestant { contestantId: string; name: string; image: string; votes: number; imageType?: string; imageSeed?: string | null }

interface Category {
  categoryId: string
  name: string
  pollPrice: number
  // Contestants can come back as an array OR a map keyed by contestantId —
  // always read through toContestantArray()/contestantCount(), never off
  // this field directly. See @/lib/contestants.
  contestants: ContestantsField
  subcategories: Category[]
}

interface Poll {
  id: string
  pollName: string
  pollImage: string
  pollDescription: string
  pollStartDate: string
  pollStartTime: string
  pollEndDate: string
  pollEndTime: string
  pollPrice: number
  pollAmount: number
  pollCount: number
  // Same story as Category.contestants above — array or map, always
  // normalized through @/lib/contestants before being read.
  contestants: ContestantsField
  pollType: "single" | "group"
  categories: Category[]
  buyerBearsBurden: boolean
  statsVisible: boolean
  createdAt: string | null
  needsNormalization: boolean
  /** "owner" (created it) or "member" (added as a poll team mate) — from
   *  /api/polls/list. Drives the "Teammate" tag on the card below. */
  role?: "owner" | "member"
}

function genId(prefix: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let id = prefix
  for (let i = 0; i < 10; i++) id += chars.charAt(Math.floor(Math.random() * chars.length))
  return id
}

/** Regenerate ids through a category tree so the duplicate doesn't collide with the source poll's ids. */
function regenerateCategoryTree(cats: Category[]): any[] {
  return (cats ?? []).map((cat) => ({
    categoryId: genId("sp-cat-"),
    name: cat.name,
    pollPrice: cat.pollPrice,
    contestants: toContestantArray(cat.contestants).map((c) => ({
      contestantId: genId("sp-cont-"),
      name: c.name,
      image: c.image,
      imageType: c.imageType,
      imageSeed: c.imageSeed,
    })),
    subcategories: regenerateCategoryTree(cat.subcategories ?? []),
  }))
}

function pad2(n: number): string { return String(n).padStart(2, "0") }
function toDateStr(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function toTimeStr(d: Date): string { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }

type PollStatus = "active" | "ended" | "upcoming"

function getPollStatus(p: Poll): PollStatus {
  const now   = new Date()
  const start = new Date(`${p.pollStartDate}T${p.pollStartTime}`)
  const end   = new Date(`${p.pollEndDate}T${p.pollEndTime}`)
  if (now < start) return "upcoming"
  if (now > end)   return "ended"
  return "active"
}

const STATUS_STYLES: Record<PollStatus, string> = {
  active:   "bg-green-100 text-green-700",
  ended:    "bg-gray-100 text-gray-600",
  upcoming: "bg-yellow-100 text-yellow-700",
}

const STATUS_ICONS: Record<PollStatus, React.ElementType> = {
  active:   CheckCircle,
  ended:    XCircle,
  upcoming: Clock,
}

export default function PollsPage() {
  const router = useRouter()
  const [polls,   setPolls]   = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<PollStatus | "all">("all")
  // Track which polls are currently being normalized
  const [normalizing, setNormalizing] = useState<Record<string, boolean>>({})
  // Track which polls are currently being duplicated
  const [duplicating, setDuplicating] = useState<Record<string, boolean>>({})

  const fetchPolls = useCallback(async () => {
    setLoading(true)
    const res = await authFetch("/api/polls/list")
    if (res.ok) {
      const data = await res.json()
      setPolls(data.polls ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      let token = getAccessToken()
      if (!token) {
        const refreshed = await tryRefreshTokens()
        if (!refreshed) { router.push("/login"); return }
        token = getAccessToken()
      }
      if (!token) { router.push("/login"); return }
      await fetchPolls()
    }
    init()
  }, [router, fetchPolls])

  const handleNormalize = async (pollId: string) => {
    setNormalizing((prev) => ({ ...prev, [pollId]: true }))
    try {
      const res = await authFetch("/api/polls/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId }),
      })
      if (res.ok) {
        // Refresh list so the card loses its needsNormalization flag
        await fetchPolls()
      } else {
        const data = await res.json()
        alert(data.error || "Normalization failed. Please try again.")
      }
    } catch {
      alert("An unexpected error occurred during normalization.")
    } finally {
      setNormalizing((prev) => ({ ...prev, [pollId]: false }))
    }
  }

  const handleDuplicate = async (poll: Poll) => {
    if (duplicating[poll.id]) return
    setDuplicating((prev) => ({ ...prev, [poll.id]: true }))
    try {
      // Preserve original duration where possible, otherwise default to 7 days
      const origStart = new Date(`${poll.pollStartDate}T${poll.pollStartTime}`)
      const origEnd   = new Date(`${poll.pollEndDate}T${poll.pollEndTime}`)
      const durationMs = (!isNaN(origStart.getTime()) && !isNaN(origEnd.getTime()) && origEnd > origStart)
        ? origEnd.getTime() - origStart.getTime()
        : 7 * 24 * 60 * 60 * 1000

      const newStart = new Date(Date.now() + 60 * 60 * 1000) // starts 1 hour from now
      const newEnd   = new Date(newStart.getTime() + durationMs)

      const body: Record<string, any> = {
        pollName: `${poll.pollName} (Copy)`,
        pollImage: poll.pollImage,
        pollDescription: poll.pollDescription,
        pollStartDate: toDateStr(newStart),
        pollStartTime: toTimeStr(newStart),
        pollEndDate: toDateStr(newEnd),
        pollEndTime: toTimeStr(newEnd),
        pollType: poll.pollType,
        buyerBearsBurden: poll.buyerBearsBurden,
        statsVisible: poll.statsVisible,
      }

      if (poll.pollType === "group") {
        // poll.categories from /api/polls/list is always [] now — categories
        // live in a subcollection and aren't fetched for the whole list for
        // performance (see api/polls/list/route.ts). Pull the real tree for
        // just this one poll before duplicating it.
        const catRes = await authFetch(`/api/polls/one?pollId=${poll.id}`)
        const catData = await catRes.json()
        if (!catRes.ok) {
          alert(catData.error || "Failed to load this poll's categories for duplication.")
          setDuplicating((prev) => ({ ...prev, [poll.id]: false }))
          return
        }
        body.categories = regenerateCategoryTree(catData.poll.categories ?? [])
      } else {
        body.pollPrice = poll.pollPrice
        body.contestants = toContestantArray(poll.contestants).map((c) => ({
          contestantId: genId("sp-cont-"),
          name: c.name,
          image: c.image,
          imageType: c.imageType,
          imageSeed: c.imageSeed,
        }))
      }

      const res = await authFetch("/api/polls/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/polls/${data.pollId}/edit`)
      } else {
        alert(data.error || "Failed to duplicate poll. Please try again.")
      }
    } catch {
      alert("An unexpected error occurred while duplicating this poll.")
    } finally {
      setDuplicating((prev) => ({ ...prev, [poll.id]: false }))
    }
  }

  const filtered = filter === "all"
    ? polls
    : polls.filter((p) => getPollStatus(p) === filter)

  const legacyCount = polls.filter((p) => p.needsNormalization).length

  const stats = {
    all:      polls.length,
    active:   polls.filter((p) => getPollStatus(p) === "active").length,
    upcoming: polls.filter((p) => getPollStatus(p) === "upcoming").length,
    ended:    polls.filter((p) => getPollStatus(p) === "ended").length,
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-7 h-7 animate-spin text-[#6b2fa5]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#6b2fa5] rounded-xl flex items-center justify-center flex-shrink-0">
              <Vote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Polls</h1>
              <p className="text-sm text-gray-500">Manage your voting campaigns</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/polls/nominations"
              className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 bg-white text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              <ListChecks className="w-4 h-4" /> Nominations
            </Link>
            <button
              onClick={fetchPolls}
              className="p-2.5 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            <Link
              href="/polls/create"
              className="flex items-center gap-2 px-4 py-2.5 bg-[#6b2fa5] text-white rounded-xl text-sm font-semibold hover:bg-[#5a1f8a] transition-colors"
            >
              <Plus className="w-4 h-4" /> New Poll
            </Link>
          </div>
        </div>

        {/* Legacy migration banner */}
        {legacyCount > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {legacyCount} poll{legacyCount > 1 ? "s need" : " needs"} migration
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                These polls use an older storage format. Click <strong>Normalize</strong> on each card
                to migrate them — this is safe and preserves all votes and data.
              </p>
            </div>
          </div>
        )}

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap mb-6">
          {(["all", "active", "upcoming", "ended"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all capitalize
                ${filter === s
                  ? "bg-[#6b2fa5] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#6b2fa5]/40"}`}
            >
              {s} ({stats[s]})
            </button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Vote className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No polls yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-6">Create your first voting campaign</p>
            <Link
              href="/polls/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6b2fa5] text-white rounded-xl text-sm font-semibold hover:bg-[#5a1f8a] transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Poll
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((poll) => {
              const status    = getPollStatus(poll)
              const StatusIcon = STATUS_ICONS[status]
              const isLegacy  = poll.needsNormalization
              const isNormalizing = normalizing[poll.id]

              return (
                <div
                  key={poll.id}
                  className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow
                    ${isLegacy ? "border-amber-300" : "border-gray-200"}`}
                >
                  {/* Legacy badge ribbon */}
                  {isLegacy && (
                    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-700 font-medium">Legacy format — needs migration</p>
                    </div>
                  )}

                  {/* Cover */}
                  <div className="h-36 bg-gray-100 overflow-hidden">
                    {poll.pollImage
                      ? <img src={poll.pollImage} alt={poll.pollName} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Vote className="w-10 h-10 text-gray-300" /></div>
                    }
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{poll.pollName}</h3>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 capitalize ${STATUS_STYLES[status]}`}>
                        <StatusIcon className="w-3 h-3" /> {status}
                      </span>
                    </div>

                    {/* Teammate tag — this poll belongs to someone else, the
                        current user is just on its team (see PollTeamPanel) */}
                    {poll.role === "member" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 mb-2 rounded-full text-[11px] font-semibold bg-purple-100 text-[#6b2fa5]">
                        <Users className="w-3 h-3" /> Teammate
                      </span>
                    )}

                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">{poll.pollDescription}</p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs font-bold text-gray-900">{poll.pollCount ?? 0}</p>
                        <p className="text-xs text-gray-400">Votes</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs font-bold text-gray-900">{contestantCount(poll.contestants)}</p>
                        <p className="text-xs text-gray-400">Entrants</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs font-bold text-gray-900">₦{(poll.pollAmount ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-gray-400">Revenue</p>
                      </div>
                    </div>

                    {/* Actions */}
                    {isLegacy ? (
                      // Legacy poll — show Normalize button prominently
                      <button
                        onClick={() => handleNormalize(poll.id)}
                        disabled={isNormalizing}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60"
                      >
                        {isNormalizing
                          ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Migrating…</>
                          : <><Shuffle className="w-3.5 h-3.5" /> Normalize</>
                        }
                      </button>
                    ) : (
                      // Normal poll — manage + settings + payout + duplicate buttons
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Link
                            href={`/polls/${poll.id}`}
                            className="flex-1 py-2 text-center bg-[#6b2fa5]/10 text-[#6b2fa5] rounded-xl text-xs font-semibold hover:bg-[#6b2fa5]/20 transition-colors flex items-center justify-center gap-1"
                          >
                            <BarChart2 className="w-3.5 h-3.5" /> Manage
                          </Link>
                          <Link
                            href={`/polls/${poll.id}/settings`}
                            className="py-2 px-3 text-center bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            href={`/polls/${poll.id}/payout`}
                            className="flex-1 py-2 text-center bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
                          >
                            <TrendingUp className="w-3.5 h-3.5" /> Payout
                          </Link>
                        </div>
                        <button
                          onClick={() => handleDuplicate(poll)}
                          disabled={!!duplicating[poll.id]}
                          title="Duplicate this poll"
                          className="w-full py-2 text-center bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:border-[#6b2fa5]/40 hover:text-[#6b2fa5] transition-colors flex items-center justify-center gap-1 disabled:opacity-60"
                        >
                          {duplicating[poll.id]
                            ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Duplicating…</>
                            : <><Copy className="w-3.5 h-3.5" /> Duplicate</>
                          }
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
