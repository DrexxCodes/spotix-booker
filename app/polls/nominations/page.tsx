"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Tag, ChevronRight, Copy, ChevronLeft } from "lucide-react"

interface NominationPollSummary {
  pollId: string
  pollName: string
  pollImage: string
  pollDescription: string
  categories: { categoryId: string; name: string }[]
  status: "active" | "closed"
  createdAt: string
}

export default function NominationPollsListPage() {
  const router = useRouter()
  const [polls, setPolls] = useState<NominationPollSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/polls/nominations")
        const data = await res.json()
        if (!res.ok) { setError(data.error || "Failed to load nomination polls"); return }
        setPolls(data.polls ?? [])
      } catch {
        setError("An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleDuplicate = async (e: React.MouseEvent, p: NominationPollSummary) => {
    e.preventDefault()
    e.stopPropagation()
    if (duplicatingId) return
    setDuplicatingId(p.pollId)
    setDuplicateError(null)
    try {
      const res = await fetch("/api/polls/nominations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollName: `${p.pollName} (Copy)`,
          pollImage: p.pollImage,
          pollDescription: p.pollDescription,
          categories: p.categories.map((c) => ({ name: c.name })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setDuplicateError(data.error || "Failed to duplicate poll"); return }
      router.push(`/polls/nominations/${data.pollId}`)
    } catch {
      setDuplicateError("An unexpected error occurred while duplicating.")
    } finally {
      setDuplicatingId(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/polls" className="inline-flex items-center gap-1 text-[#6b2fa5] hover:text-[#5a1f8a] text-sm font-medium mb-6">
        <ChevronLeft className="w-4 h-4 flex-shrink-0" /> Back to Polls
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nomination Polls</h1>
          <p className="text-slate-500 text-sm mt-1">Open nomination pools you've created</p>
        </div>
        <Link
          href="/polls/create/nomination"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#6b2fa5] hover:bg-[#5a1f8a] transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> New
        </Link>
      </div>

      {duplicateError && (
        <p className="text-center text-red-600 text-xs mb-4">{duplicateError}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#6b2fa5]" /></div>
      ) : error ? (
        <p className="text-center text-red-600 text-sm py-16">{error}</p>
      ) : polls.length === 0 ? (
        <div className="text-center py-16 bg-white/50 rounded-2xl border-2 border-dashed border-slate-300">
          <p className="text-slate-500 font-medium mb-3">No nomination polls yet</p>
          <Link href="/polls/create/nomination" className="text-[#6b2fa5] text-sm font-semibold">
            Create your first one →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {polls.map((p) => (
            <div
              key={p.pollId}
              className="flex items-center gap-3 sm:gap-4 bg-white rounded-2xl border border-slate-200 p-4 hover:border-[#6b2fa5] transition-colors"
            >
              <Link href={`/polls/nominations/${p.pollId}`} className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <img src={p.pollImage || "/placeholder.svg"} alt="" className="w-14 h-14 rounded-xl object-cover bg-slate-100 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 truncate" title={p.pollName}>{p.pollName}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <Tag className="w-3 h-3 flex-shrink-0" /> {p.categories.length} categor{p.categories.length === 1 ? "y" : "ies"}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0
                  ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                  {p.status === "active" ? "Active" : "Closed"}
                </span>
                <button
                  onClick={(e) => handleDuplicate(e, p)}
                  disabled={duplicatingId === p.pollId}
                  title="Duplicate"
                  className="p-2 rounded-lg text-slate-400 hover:text-[#6b2fa5] hover:bg-[#6b2fa5]/5 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {duplicatingId === p.pollId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                </button>
                <Link href={`/polls/nominations/${p.pollId}`} className="flex-shrink-0">
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
