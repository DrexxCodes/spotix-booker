"use client"

import { useMemo, useState } from "react"
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts"

interface SeriesPoint {
  label: string
  date: string
  revenue: number
  ticketsSold: number
}

interface TimeSeries {
  daily: SeriesPoint[]
  monthly: SeriesPoint[]
  yearly: SeriesPoint[]
}

type Granularity = "d" | "m" | "y"

function fmtCurrency(n: number) {
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="pwa-glass-strong rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-[#1e1330]">{label}</p>
      <p className="text-[#6b2fa5]">Revenue: {fmtCurrency(point.revenue)}</p>
      <p className="text-pink-500">Tickets: {point.ticketsSold.toLocaleString()}</p>
    </div>
  )
}

export function PwaRevenueChart({ timeSeries }: { timeSeries: TimeSeries }) {
  const [granularity, setGranularity] = useState<Granularity>("d")

  const raw = granularity === "d" ? timeSeries.daily : granularity === "m" ? timeSeries.monthly : timeSeries.yearly

  // Normalize both series to % of their own period max so currency and
  // ticket-count — different units — can sit as comparable bar heights
  // without implying a shared numeric axis. Actual figures live in the
  // tooltip, not the bar height.
  const data = useMemo(() => {
    const maxRevenue = Math.max(1, ...raw.map((p) => p.revenue))
    const maxTickets = Math.max(1, ...raw.map((p) => p.ticketsSold))
    return raw.map((p) => ({
      ...p,
      revenuePct: Math.round((p.revenue / maxRevenue) * 100),
      ticketsPct: Math.round((p.ticketsSold / maxTickets) * 100),
    }))
  }, [raw])

  const hasData = raw.some((p) => p.revenue > 0 || p.ticketsSold > 0)

  return (
    <div className="pwa-glass rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#1e1330]/40">Revenue statistics</p>
          <h3 className="text-sm font-bold text-[#1e1330]">By event date</h3>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-[#6b2fa5]/8 p-1">
          {(["d", "m", "y"] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`h-6 w-6 rounded-full text-[11px] font-bold uppercase transition-colors ${
                granularity === g ? "bg-white text-[#6b2fa5] shadow-sm" : "text-[#1e1330]/40"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {hasData ? (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#1e133066" }}
                interval={granularity === "d" ? 1 : 0}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(107,47,165,0.06)" }} />
              <Bar dataKey="revenuePct" fill="#6b2fa5" radius={[4, 4, 0, 0]} maxBarSize={10} />
              <Bar dataKey="ticketsPct" fill="#f0abfc" radius={[4, 4, 0, 0]} maxBarSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center text-center">
          <p className="text-xs text-[#1e1330]/35">
            No events in this period yet — the chart fills in as events happen.
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 text-xs text-[#1e1330]/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#6b2fa5]" /> Revenue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#f0abfc]" /> Tickets
        </span>
      </div>
    </div>
  )
}
