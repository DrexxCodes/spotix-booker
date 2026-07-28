"use client"

import { Loader2, ImagePlus, Users, User } from "lucide-react"
import { doUpload, type PollForm } from "../lib/factories"

interface PollInfoStepProps {
  form: PollForm
  onChange: (updated: PollForm) => void
  uploading: boolean
  setUploading: (v: boolean) => void
}

export function PollInfoStep({ form, onChange, uploading, setUploading }: PollInfoStepProps) {
  const handleImage = async (file: File | undefined) => {
    if (!file) return
    const preview = URL.createObjectURL(file)
    onChange({ ...form, pollImagePreview: preview })
    setUploading(true)
    const url = await doUpload(file, "spotix/polls/cover")
    onChange({ ...form, pollImagePreview: preview, pollImageUrl: url })
    setUploading(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Poll Name</label>
        <input
          type="text"
          placeholder="e.g. Campus Face of the Year 2026"
          value={form.pollName}
          onChange={(e) => onChange({ ...form, pollName: e.target.value })}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Cover Image</label>
        <label className="relative block h-44 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#6b2fa5] cursor-pointer overflow-hidden transition-colors">
          {form.pollImagePreview ? (
            <img src={form.pollImagePreview} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
              <ImagePlus className="w-8 h-8 mb-2" />
              <p className="text-sm">Click to upload a cover image</p>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
        </label>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
        <textarea
          rows={4}
          placeholder="What is this poll about?"
          value={form.pollDescription}
          onChange={(e) => onChange({ ...form, pollDescription: e.target.value })}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5] focus:ring-2 focus:ring-[#6b2fa5]/20 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Poll Type</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onChange({ ...form, pollType: "single" })}
            className={`flex items-center gap-2 p-4 rounded-xl border-2 transition-colors
              ${form.pollType === "single" ? "border-[#6b2fa5] bg-[#6b2fa5]/5" : "border-slate-200 hover:border-slate-300"}`}
          >
            <User className="w-5 h-5 text-[#6b2fa5]" />
            <div className="text-left">
              <p className="font-semibold text-sm text-slate-900">Single</p>
              <p className="text-xs text-slate-500">One flat list of contestants</p>
            </div>
          </button>
          <button
            onClick={() => onChange({ ...form, pollType: "group" })}
            className={`flex items-center gap-2 p-4 rounded-xl border-2 transition-colors
              ${form.pollType === "group" ? "border-[#6b2fa5] bg-[#6b2fa5]/5" : "border-slate-200 hover:border-slate-300"}`}
          >
            <Users className="w-5 h-5 text-[#6b2fa5]" />
            <div className="text-left">
              <p className="font-semibold text-sm text-slate-900">Group</p>
              <p className="text-xs text-slate-500">Categories & sub-categories</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
