// app/components/event-info/apiAccess.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { Code2, Loader2, Check, ExternalLink, Copy, Palette, BookOpen, PlayCircle } from "lucide-react"
import { authFetch } from "@/lib/auth-client"

interface ApiAccessTabProps {
  eventId: string
  allowAPIAccess: boolean
  widgetLength?: number
  widgetHeight?: number
  widgetColour?: string
}

const PRESET_COLOURS = ["#6b2fa5", "#f5a623", "#0ea5e9", "#16a34a", "#dc2626", "#111827"]

export default function ApiAccessTab({
  eventId,
  allowAPIAccess: initialAllow,
  widgetLength: initialLength = 320,
  widgetHeight: initialHeight = 420,
  widgetColour: initialColour = "#6b2fa5",
}: ApiAccessTabProps) {
  const [allowAPIAccess, setAllowAPIAccess] = useState(initialAllow)
  const [widgetLength, setWidgetLength] = useState(initialLength)
  const [widgetHeight, setWidgetHeight] = useState(initialHeight)
  const [widgetColour, setWidgetColour] = useState(initialColour)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const widgetUrl = `https://api.spotix.com.ng/v1/widget?eventId=${eventId}&widgetLength=${widgetLength}&widgetHeight=${widgetHeight}&widgetColour=${encodeURIComponent(widgetColour)}`
  const embedSnippet = `<iframe src="${widgetUrl}" width="${widgetLength}" height="${widgetHeight}" frameborder="0"></iframe>`

  async function save(patch: Record<string, any>) {
    setSaving(true)
    setSaved(false)
    try {
      const res = await authFetch(`/api/event/list/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apiAccess", ...patch }),
      })
      const data = await res.json()
      if (data.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1800)
      }
    } finally {
      setSaving(false)
    }
  }

  function toggleAccess() {
    const next = !allowAPIAccess
    setAllowAPIAccess(next)
    save({ allowAPIAccess: next })
  }

  function copySnippet() {
    navigator.clipboard.writeText(embedSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6b2fa5]/10 flex items-center justify-center">
            <Code2 size={18} className="text-[#6b2fa5]" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">API access for this event</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Controls whether SDK keys can reach <code>/v1/event</code>, <code>/v1/widget</code>, and{" "}
              <code>/v1/lookup</code> for this specific event.
            </p>
          </div>
        </div>
        <button
          onClick={toggleAccess}
          disabled={saving}
          className={
            "relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 " +
            (allowAPIAccess ? "bg-[#6b2fa5]" : "bg-gray-300")
          }
          aria-label="Toggle API access"
        >
          <span
            className={
              "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ease-in-out " +
              (allowAPIAccess ? "translate-x-6" : "translate-x-0")
            }
          />
        </button>
      </div>

      {/* Docs & Playground guidance */}
      <div className="bg-[#6b2fa5]/5 rounded-xl p-5 border-2 border-[#6b2fa5]/15 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-[#6b2fa5]/15 shrink-0">
            <BookOpen size={18} className="text-[#6b2fa5]" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">New to the Spotix API?</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Read the docs to see available endpoints and auth, or jump into the playground to try live
              requests with your key before you integrate.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/sdk/v1/docs">
            <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#6b2fa5]/25 bg-white text-[#6b2fa5] text-xs font-semibold hover:bg-[#6b2fa5]/10 transition-colors">
              <BookOpen size={13} /> Read the docs
            </button>
          </Link>
          <Link href="/sdk/v1/playground">
            <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#6b2fa5] text-white text-xs font-semibold hover:bg-[#5a2589] transition-colors shadow-sm shadow-[#6b2fa5]/20">
              <PlayCircle size={13} /> Try the playground
            </button>
          </Link>
        </div>
      </div>

      {allowAPIAccess && (
        <>
          {/* Widget config */}
          <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Palette size={16} className="text-slate-500" />
              <p className="font-semibold text-slate-800 text-sm">Embeddable widget</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Width (px)</label>
                <input
                  type="number"
                  min={120}
                  max={800}
                  value={widgetLength}
                  onChange={(e) => setWidgetLength(Number(e.target.value))}
                  onBlur={() => save({ widgetLength })}
                  className="w-full h-9 rounded-xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Height (px)</label>
                <input
                  type="number"
                  min={120}
                  max={800}
                  value={widgetHeight}
                  onChange={(e) => setWidgetHeight(Number(e.target.value))}
                  onBlur={() => save({ widgetHeight })}
                  className="w-full h-9 rounded-xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Accent colour</label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLOURS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setWidgetColour(c)
                      save({ widgetColour: c })
                    }}
                    style={{ backgroundColor: c }}
                    className={
                      "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 " +
                      (widgetColour.toLowerCase() === c.toLowerCase() ? "border-slate-800" : "border-transparent")
                    }
                    aria-label={c}
                  />
                ))}
                <input
                  type="color"
                  value={widgetColour}
                  onChange={(e) => setWidgetColour(e.target.value)}
                  onBlur={() => save({ widgetColour })}
                  className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer"
                  aria-label="Custom colour picker"
                />
                <span className="text-xs font-mono text-slate-500">{widgetColour}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-500">Embed snippet</label>
                <button onClick={copySnippet} className="text-xs text-[#6b2fa5] hover:underline flex items-center gap-1">
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="bg-gray-900 text-green-400 text-xs rounded-xl p-3 overflow-x-auto font-mono">
                {embedSnippet}
              </pre>
              <a
                href={widgetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#6b2fa5] mt-2"
              >
                Preview widget <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </>
      )}

      <div className="text-xs text-slate-400 flex items-center gap-1.5 h-4">
        {saving && (
          <>
            <Loader2 size={12} className="animate-spin" /> Saving…
          </>
        )}
        {saved && (
          <>
            <Check size={12} className="text-green-500" /> Saved
          </>
        )}
      </div>
    </div>
  )
}
