"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import {
  Loader, Plus, Vote, TrendingUp, Clock, CheckCircle,
  XCircle, BarChart2, AlertTriangle, RefreshCw, Shuffle, Settings2,
} from "lucide-react"

interface Contestant { contestantId: string; name: string; image: string; votes: number }

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
  contestants: Contestant[]
  createdAt: string | null
  needsNormalization: boolean
}

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
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#6b2fa5] rounded-xl flex items-center justify-center">
              <Vote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Polls</h1>
              <p className="text-sm text-gray-500">Manage your voting campaigns</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">{poll.pollDescription}</p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs font-bold text-gray-900">{poll.pollCount ?? 0}</p>
                        <p className="text-xs text-gray-400">Votes</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs font-bold text-gray-900">{poll.contestants?.length ?? 0}</p>
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
                      // Normal poll — manage + settings + payout buttons
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
