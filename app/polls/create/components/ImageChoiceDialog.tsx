"use client"

import { Upload, Wand2, X } from "lucide-react"

interface ImageChoiceDialogProps {
  onUpload: () => void
  onGenerate: () => void
  onClose: () => void
}

export function ImageChoiceDialog({ onUpload, onGenerate, onClose }: ImageChoiceDialogProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-slate-900">Add contestant photo</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 -mt-1 -mr-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Upload your image or we will generate one for you.
        </p>

        <div className="space-y-2.5">
          <button
            onClick={onUpload}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-slate-200 hover:border-[#6b2fa5] transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-[#6b2fa5]/10 flex items-center justify-center flex-shrink-0">
              <Upload className="w-4 h-4 text-[#6b2fa5]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Upload your image</p>
              <p className="text-xs text-slate-500">Choose a photo from your device</p>
            </div>
          </button>

          <button
            onClick={onGenerate}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-slate-200 hover:border-[#6b2fa5] transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-[#6b2fa5]/10 flex items-center justify-center flex-shrink-0">
              <Wand2 className="w-4 h-4 text-[#6b2fa5]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Generate an avatar</p>
              <p className="text-xs text-slate-500">We'll create a unique avatar automatically</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
