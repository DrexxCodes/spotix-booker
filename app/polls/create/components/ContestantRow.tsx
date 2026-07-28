"use client"

import { useRef, useState } from "react"
import { Loader2, X, ImagePlus, User, Wand2 } from "lucide-react"
import { dicebearAvatarUrl } from "@/lib/dicebear"
import { genContestantId, doUpload, type ContestantForm } from "../lib/factories"
import { ImageChoiceDialog } from "./ImageChoiceDialog"

interface ContestantRowProps {
  contestant: ContestantForm
  index: number
  folder: string
  onChange: (updated: ContestantForm) => void
  onRemove: () => void
  removable: boolean
}

export function ContestantRow({ contestant, index, folder, onChange, onRemove, removable }: ContestantRowProps) {
  const [showChoice, setShowChoice] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const preview = URL.createObjectURL(file)
    const withId = contestant.contestantId || genContestantId()
    onChange({ ...contestant, contestantId: withId, imagePreview: preview, imageType: "uploaded", uploading: true })

    const url = await doUpload(file, folder)
    onChange({ ...contestant, contestantId: withId, imagePreview: preview, imageUrl: url, imageType: "uploaded", uploading: false })
  }

  const handleGenerate = () => {
    const withId = contestant.contestantId || genContestantId()
    const url = dicebearAvatarUrl(withId)
    onChange({ ...contestant, contestantId: withId, imagePreview: url, imageUrl: url, imageType: "generated", uploading: false })
    setShowChoice(false)
  }

  const handleUploadChoice = () => {
    setShowChoice(false)
    // Defer to next tick so the dialog unmounts before the native file picker opens
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3">
      <button
        type="button"
        onClick={() => setShowChoice(true)}
        className="relative w-14 h-14 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden group"
      >
        {contestant.imagePreview ? (
          <img src={contestant.imagePreview} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <User className="w-6 h-6" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          {contestant.uploading
            ? <Loader2 className="w-4 h-4 text-white animate-spin" />
            : contestant.imageType === "generated"
            ? <Wand2 className="w-4 h-4 text-white" />
            : <ImagePlus className="w-4 h-4 text-white" />}
        </div>
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

      <input
        type="text"
        placeholder={`Contestant ${index + 1} name`}
        value={contestant.name}
        onChange={(e) => onChange({ ...contestant, name: e.target.value })}
        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-[#6b2fa5]"
      />

      {removable && (
        <button onClick={onRemove} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      )}

      {showChoice && (
        <ImageChoiceDialog
          onUpload={handleUploadChoice}
          onGenerate={handleGenerate}
          onClose={() => setShowChoice(false)}
        />
      )}
    </div>
  )
}
