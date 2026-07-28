"use client"

import { useEffect, useState } from "react"
import { X, Loader2, FileText, Trash2 } from "lucide-react"

interface DraftSummary {
  draftId: string
  label: string
  updatedAt: string
}

interface LoadDraftDialogProps {
  kind: "poll" | "nomination"
  onClose: () => void
  onSelect: (draftId: string) => void
}

export function LoadDraftDialog({ kind, onClose, onSelect }: LoadDraftDialogProps) {
  const [drafts, setDrafts] = useState<DraftSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/polls/drafts?kind=${kind}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Failed to load drafts"); return }
      setDrafts(data.drafts ?? [])
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(draftId)
    try {
      await fetch(`/api/polls/drafts/${draftId}?kind=${kind}`, { method: "DELETE" })
      setDrafts((prev) => prev.filter((d) => d.draftId !== draftId))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">Saved Drafts</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#6b2fa5]" /></div>
          ) : error ? (
            <p className="text-center text-red-600 text-sm py-8">{error}</p>
          ) : drafts.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No saved drafts yet.</p>
          ) : (
            <div className="space-y-2">
              {drafts.map((d) => (
                <button
                  key={d.draftId}
                  onClick={() => onSelect(d.draftId)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-[#6b2fa5] transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#6b2fa5]/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-[#6b2fa5]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{d.label}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(d.updatedAt).toLocaleString()} · {d.draftId}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(d.draftId, e)}
                    disabled={deletingId === d.draftId}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    {deletingId === d.draftId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
