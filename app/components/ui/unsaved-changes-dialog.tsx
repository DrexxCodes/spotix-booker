"use client"

import { AlertTriangle } from "lucide-react"

interface UnsavedChangesDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Shared "leave without saving?" confirmation — pair with
 * hooks/useUnsavedChangesWarning.ts. Used on create-event, poll create/
 * edit, and election create (item 8 of the UI renovation).
 */
export function UnsavedChangesDialog({ open, onConfirm, onCancel }: UnsavedChangesDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" role="alertdialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Leave without saving?</h2>
        <p className="text-sm text-slate-500 mt-1.5">
          Your changes haven't been saved yet. If you leave now, they'll be lost.
        </p>
        <div className="flex gap-2.5 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Keep editing
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Leave page
          </button>
        </div>
      </div>
    </div>
  )
}
