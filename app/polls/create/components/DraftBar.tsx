"use client"

import { useState } from "react"
import { Save, FolderOpen, Loader2, Check, Copy } from "lucide-react"

interface DraftBarProps {
  draftId: string | null
  saving: boolean
  lastSavedAt: string | null
  onSave: () => void
  onOpenLoadDialog: () => void
}

export function DraftBar({ draftId, saving, lastSavedAt, onSave, onOpenLoadDialog }: DraftBarProps) {
  const [copied, setCopied] = useState(false)

  const copyId = async () => {
    if (!draftId) return
    try {
      await navigator.clipboard.writeText(draftId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard not available — non-fatal */ }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-300 hover:border-[#6b2fa5] hover:text-[#6b2fa5] transition-colors disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Save as Draft
      </button>

      <button
        onClick={onOpenLoadDialog}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-300 hover:border-[#6b2fa5] hover:text-[#6b2fa5] transition-colors"
      >
        <FolderOpen className="w-3.5 h-3.5" /> Load Draft
      </button>

      {draftId && (
        <button
          onClick={copyId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#6b2fa5]/5 text-xs font-mono text-[#6b2fa5]"
          title="Copy draft ID"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {draftId}
        </button>
      )}

      {lastSavedAt && (
        <span className="text-xs text-slate-400">Saved {new Date(lastSavedAt).toLocaleTimeString()}</span>
      )}
    </div>
  )
}
