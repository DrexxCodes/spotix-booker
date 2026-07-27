// app/sdk/v1/playground/page.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Play, Loader2, FlaskConical, Radio, Copy, Check, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

const API_BASE = process.env.NEXT_PUBLIC_SPOTIX_API_BASE_URL || "https://api.spotix.com.ng"
const MOCK_API_KEY = process.env.NEXT_PUBLIC_SPOTIX_MOCK_API_KEY || "" // safe to expose: 20 req/day, no real data

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT"

interface EndpointPreset {
  id: string
  method: HttpMethod
  path: string
  bodyStyle: "json" | "query" | "none"
  sampleBody?: string
  sampleQuery?: string
}

const PRESETS: EndpointPreset[] = [
  { id: "event.get", method: "GET", path: "/v1/event", bodyStyle: "query", sampleQuery: "eventId=mock-event-0001" },
  { id: "event.edit", method: "PATCH", path: "/v1/event", bodyStyle: "json", sampleBody: '{\n  "eventId": "mock-event-0001",\n  "eventDescription": "Updated via playground"\n}' },
  { id: "event.stats", method: "POST", path: "/v1/event/stats", bodyStyle: "json", sampleBody: '{\n  "eventId": "mock-event-0001"\n}' },
  {
    id: "event.create",
    method: "POST",
    path: "/v1/event/create/single",
    bodyStyle: "json",
    sampleBody:
      '{\n  "eventName": "Playground Test Event",\n  "eventDescription": "Created from the SDK playground",\n  "eventDate": "2026-10-01",\n  "eventVenue": "Test Venue, Lagos",\n  "eventStart": "18:00",\n  "eventEnd": "22:00",\n  "eventEndDate": "2026-10-01",\n  "eventType": "Concert",\n  "eventImages": ["https://example.com/cover.jpg"]\n}',
  },
  {
    id: "transaction.initialize",
    method: "POST",
    path: "/v1/transaction/initialize",
    bodyStyle: "json",
    sampleBody:
      '{\n  "eventId": "mock-event-0001",\n  "buyerName": "Ada Sample",\n  "buyerEmail": "ada@example.com",\n  "qty": 2,\n  "ticketType": "Regular"\n}',
  },
  { id: "transaction.url", method: "POST", path: "/v1/transaction", bodyStyle: "json", sampleBody: '{\n  "transactionRef": "SPTX-MOCK-8f3a1c9e"\n}' },
  { id: "transaction.verify", method: "POST", path: "/v1/transaction/verify", bodyStyle: "json", sampleBody: '{\n  "transactionRef": "SPTX-MOCK-8f3a1c9e"\n}' },
  { id: "widget", method: "GET", path: "/v1/widget", bodyStyle: "query", sampleQuery: "eventId=mock-event-0001&widgetColour=%236b2fa5" },
  { id: "lookup", method: "GET", path: "/v1/lookup", bodyStyle: "query", sampleQuery: "userEmail=ada.sample@example.com&limit=5" },
]

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-green-600 bg-green-50",
  POST: "text-blue-600 bg-blue-50",
  PATCH: "text-amber-600 bg-amber-50",
  PUT: "text-amber-600 bg-amber-50",
}

export default function SdkPlaygroundPage() {
  const [mode, setMode] = useState<"mock" | "live">("mock")
  const [liveKey, setLiveKey] = useState("")
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const preset = PRESETS.find((p) => p.id === presetId)!
  const [body, setBody] = useState(preset.sampleBody ?? "")
  const [query, setQuery] = useState(preset.sampleQuery ?? "")
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<{ status: number; body: string; durationMs: number } | null>(null)
  const [copied, setCopied] = useState(false)

  function selectPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id)!
    setPresetId(id)
    setBody(p.sampleBody ?? "")
    setQuery(p.sampleQuery ?? "")
    setResponse(null)
  }

  async function send() {
    if (mode === "live" && !liveKey.trim()) {
      setResponse({ status: 0, body: "Paste your live API key first, or switch to Mock Mode.", durationMs: 0 })
      return
    }

    setLoading(true)
    setResponse(null)
    const startedAt = performance.now()
    try {
      const apiKey = mode === "mock" ? MOCK_API_KEY : liveKey.trim()
      const url = preset.bodyStyle === "query" ? `${API_BASE}${preset.path}?${query}` : `${API_BASE}${preset.path}`
      const canHaveBody = preset.method !== "GET" && preset.bodyStyle === "json"

      const res = await fetch(url, {
        method: preset.method,
        headers: {
          "x-api-key": apiKey,
          ...(canHaveBody ? { "Content-Type": "application/json" } : {}),
        },
        ...(canHaveBody ? { body } : {}),
      })

      const contentType = res.headers.get("content-type") || ""
      const text = contentType.includes("application/json") ? JSON.stringify(await res.json(), null, 2) : await res.text()

      setResponse({ status: res.status, body: text, durationMs: Math.round(performance.now() - startedAt) })
    } catch (err: any) {
      setResponse({ status: 0, body: `Request failed: ${err.message}`, durationMs: Math.round(performance.now() - startedAt) })
    } finally {
      setLoading(false)
    }
  }

  function copyResponse() {
    if (!response) return
    navigator.clipboard.writeText(response.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/sdk/v1/docs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#6b2fa5] mb-3">
              <ArrowLeft size={15} /> Back to docs
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">API Playground</h1>
          </div>

          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
            <button
              onClick={() => setMode("mock")}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                mode === "mock" ? "bg-[#6b2fa5] text-white" : "text-gray-500"
              }`}
            >
              <FlaskConical size={13} /> Mock Mode
            </button>
            <button
              onClick={() => setMode("live")}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                mode === "live" ? "bg-[#6b2fa5] text-white" : "text-gray-500"
              }`}
            >
              <Radio size={13} /> Live Mode
            </button>
          </div>
        </div>

        {mode === "mock" ? (
          <p className="text-xs text-gray-400 mb-4">
            Mock Mode hits static sample data — 20 requests/day, nothing is persisted, and only
            <code className="mx-1 bg-gray-100 px-1 rounded">event1.jpg</code>/
            <code className="mx-1 bg-gray-100 px-1 rounded">event2.jpg</code> exist as assets.
          </p>
        ) : (
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Your live API key</label>
            <Input
              type="password"
              value={liveKey}
              onChange={(e) => setLiveKey(e.target.value)}
              placeholder="spk_live_..."
              className="max-w-md"
            />
            <p className="text-xs text-amber-600 mt-1">Live Mode makes real requests against your account. Be careful with POST/PATCH.</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          {/* Request builder */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Endpoint</label>
              <select
                value={presetId}
                onChange={(e) => selectPreset(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.method} {p.path}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${METHOD_COLORS[preset.method]}`}>{preset.method}</span>
              <code className="text-sm text-gray-700">{preset.path}</code>
            </div>

            {preset.bodyStyle === "json" && (
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">JSON body</label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="font-mono text-xs" />
              </div>
            )}

            {preset.bodyStyle === "query" && (
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Query string</label>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} className="font-mono text-xs" />
              </div>
            )}

            <Button onClick={send} disabled={loading} className="w-full inline-flex items-center justify-center gap-1.5">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Send request
            </Button>
          </div>

          {/* Response */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500">Response</label>
              {response && (
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      response.status >= 200 && response.status < 300
                        ? "text-green-600 bg-green-50"
                        : response.status === 0
                          ? "text-gray-500 bg-gray-100"
                          : "text-red-600 bg-red-50"
                    }`}
                  >
                    {response.status || "—"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                    <Clock size={11} /> {response.durationMs}ms
                  </span>
                  <button onClick={copyResponse} className="text-gray-400 hover:text-[#6b2fa5]">
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              )}
            </div>
            <pre className="bg-gray-900 text-gray-100 text-xs rounded-xl p-4 overflow-auto font-mono h-[340px] leading-relaxed">
              {response ? response.body : "// response will appear here"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
