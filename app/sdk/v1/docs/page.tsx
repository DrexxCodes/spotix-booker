// app/sdk/v1/docs/page.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ArrowLeft, ExternalLink, Copy, Check } from "lucide-react"

interface Endpoint {
  method: string
  path: string
  description: string
  required: string
  optional?: string
  request: string
  response: string
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/v1/event",
    description: "Fetch event details. Returns only the fields listed in `param`, if provided — useful for avoiding a full event dump.",
    required: "eventId (query)",
    optional: "param (comma-separated list of field names)",
    request: `GET /v1/event?eventId=abc123&param=eventName,eventVenue,ticketPrices`,
    response: `{
  "success": true,
  "event": {
    "id": "abc123",
    "eventName": "Afrobeats Night",
    "eventVenue": "Sample Arena, Lagos",
    "ticketPrices": [{ "policy": "Regular", "price": 5000, "quantity": 400 }]
  }
}`,
  },
  {
    method: "PATCH / PUT",
    path: "/v1/event",
    description: "Edit event details. eventVenue, venueCoordinates, and all date fields (eventDate/eventStart/eventEnd/eventEndDate) are strictly read-only.",
    required: "eventId (body)",
    optional: "any editable field",
    request: `{
  "eventId": "abc123",
  "eventDescription": "Updated description"
}`,
    response: `{
  "success": true,
  "eventId": "abc123",
  "updatedFields": ["eventDescription"]
}`,
  },
  {
    method: "POST",
    path: "/v1/event/stats",
    description: "Fetch live stats for an event. Pass PTL (seconds, min 8) to open a real-time SSE pool instead of a single snapshot. Every poll tick counts toward your rate limit.",
    required: "eventId (body)",
    optional: "PTL (Pool-Time Listeners, seconds)",
    request: `{ "eventId": "abc123", "PTL": 15 }`,
    response: `data: {"eventId":"abc123","ticketsSold":214,"grossRevenue":1780000,...}`,
  },
  {
    method: "POST",
    path: "/v1/event/create/single",
    description: "Create a single event through the API — identical to creating one in the booker dashboard.",
    required: "eventName, eventDescription, eventDate, eventVenue, eventStart, eventEnd, eventEndDate, eventType, eventImages",
    request: `{
  "eventName": "Afrobeats Night",
  "eventDescription": "A night of live Afrobeats",
  "eventDate": "2026-09-12",
  "eventVenue": "Sample Arena, Lagos",
  "eventStart": "18:00",
  "eventEnd": "23:00",
  "eventEndDate": "2026-09-12",
  "eventType": "Concert",
  "eventImages": ["https://.../cover.jpg"],
  "enablePricing": true,
  "ticketPrices": [{ "policy": "Regular", "price": 5000, "quantity": 400 }]
}`,
    response: `{ "success": true, "eventId": "abc123" }`,
  },
  {
    method: "POST",
    path: "/v1/transaction/initialize",
    description: "Generates a transaction reference and opens a Paystack checkout. Repeat calls with the same buyer/event/ticketType/qty within 7 days return the cached transaction instead of creating a duplicate.",
    required: "eventId, buyerName, buyerEmail, qty, ticketType",
    optional: "buyerPhone, orgKey",
    request: `{
  "eventId": "abc123",
  "buyerName": "Ada Sample",
  "buyerEmail": "ada@example.com",
  "qty": 2,
  "ticketType": "Regular"
}`,
    response: `{
  "success": true,
  "transactionRef": "SPTX-8f3a1c9e...",
  "transactionUrl": "https://checkout.paystack.com/..."
}`,
  },
  {
    method: "POST",
    path: "/v1/transaction",
    description: "Accepts a transactionRef and returns its transactionUrl — handy for re-sharing a checkout link.",
    required: "transactionRef",
    request: `{ "transactionRef": "SPTX-8f3a1c9e..." }`,
    response: `{ "success": true, "transactionRef": "SPTX-8f3a1c9e...", "transactionUrl": "https://checkout.paystack.com/..." }`,
  },
  {
    method: "POST",
    path: "/v1/transaction/verify",
    description: "Verifies payment status against Paystack and returns ticket details. Attendee names/emails are masked if an orgKey mismatch applies.",
    required: "transactionRef",
    request: `{ "transactionRef": "SPTX-8f3a1c9e..." }`,
    response: `{
  "success": true,
  "status": "successful",
  "tickets": [{ "ticketId": "t_1", "buyerName": "Ada Sample", "qrCode": "..." }]
}`,
  },
  {
    method: "GET",
    path: "/v1/widget",
    description: "Serves an embeddable HTML ticket widget for an event, styled per widgetLength/widgetHeight/widgetColour. Always shows \"Powered by Spotix\".",
    required: "eventId (query)",
    optional: "widgetLength, widgetHeight, widgetColour (hex)",
    request: `GET /v1/widget?eventId=abc123&widgetColour=%236b2fa5`,
    response: `<!-- returns text/html — drop straight into an <iframe> -->`,
  },
  {
    method: "GET",
    path: "/v1/lookup",
    description: "Looks up tickets by email or phone. If eventId is given, results are scoped by your key's access level (Tied vs General).",
    required: "userEmail OR userPhone (query)",
    optional: "limit (1–25, default 10), eventId",
    request: `GET /v1/lookup?userEmail=ada@example.com&limit=5`,
    response: `{ "success": true, "results": [{ "ticketId": "t_1", "buyerName": "Ada Sample" }], "count": 1 }`,
  },
]

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => {
          navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
        aria-label="Copy code"
      >
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
      <pre className="bg-gray-900 text-gray-100 text-xs rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">
        {code}
      </pre>
    </div>
  )
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-600 bg-green-50",
  POST: "text-blue-600 bg-blue-50",
  "PATCH / PUT": "text-amber-600 bg-amber-50",
}

export default function SdkDocsPage() {
  const [version, setVersion] = useState("v1")

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/sdk/key/manage" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#6b2fa5] mb-3">
              <ArrowLeft size={15} /> Back to keys
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Spotix API Reference</h1>
            <p className="text-sm text-gray-500 mt-1">Base URL: <code className="bg-gray-100 px-1.5 py-0.5 rounded">api.spotix.com.ng</code></p>
          </div>

          <div className="relative">
            <select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-xl pl-3 pr-8 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
            >
              <option value="v1">v1</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-2">Authentication</h2>
          <p className="text-sm text-gray-600 mb-3">
            Every request needs an API key, sent as either header. Get one from{" "}
            <Link href="/sdk/setup" className="text-[#6b2fa5] hover:underline">
              API key setup
            </Link>
            .
          </p>
          <CodeBlock code={`x-api-key: spk_live_...\n\n# or\nAuthorization: Bearer spk_live_...`} />
          <p className="text-xs text-gray-400 mt-3">
            Rate limits: 500 requests/minute, 1,000/day per key. Try requests risk-free first in the{" "}
            <Link href="/sdk/v1/playground" className="text-[#6b2fa5] hover:underline">
              playground
            </Link>{" "}
            (Mock Mode, 20 requests/day, no real data touched).
          </p>
        </div>

        <div className="space-y-6">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path + ep.method} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${METHOD_COLORS[ep.method] ?? "text-gray-600 bg-gray-100"}`}>
                  {ep.method}
                </span>
                <code className="text-sm font-semibold text-gray-800">{ep.path}</code>
              </div>
              <p className="text-sm text-gray-600 mb-3">{ep.description}</p>
              <div className="text-xs text-gray-500 mb-3 space-y-0.5">
                <div>
                  <span className="font-medium text-gray-700">Required:</span> {ep.required}
                </div>
                {ep.optional && (
                  <div>
                    <span className="font-medium text-gray-700">Optional:</span> {ep.optional}
                  </div>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1">Request</p>
                  <CodeBlock code={ep.request} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1">Response</p>
                  <CodeBlock code={ep.response} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-8 flex items-center gap-1">
          Want to try these live?{" "}
          <Link href="/sdk/v1/playground" className="text-[#6b2fa5] hover:underline inline-flex items-center gap-1">
            Open the playground <ExternalLink size={11} />
          </Link>
        </p>
      </div>
    </div>
  )
}
