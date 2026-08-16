"use client"

import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts"

interface DayBucket {
  date: string
  label: string
  ticketsPurchased: number
  votesCast: number
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="pwa-glass-strong rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-[#1e1330]">{label}</p>
      <p className="text-[#6b2fa5]">Tickets: {point.ticketsPurchased.toLocaleString()}</p>
      <p className="text-cyan-500">Votes: {point.votesCast.toLocaleString()}</p>
    </div>
  )
}

export function PwaPurchaseTrendChart({ days }: { days: DayBucket[] }) {
  const hasData = days.some((d) => d.ticketsPurchased > 0 || d.votesCast > 0)
  const totalTickets = days.reduce((sum, d) => sum + d.ticketsPurchased, 0)
  const totalVotes = days.reduce((sum, d) => sum + d.votesCast, 0)

  return (
    <div className="pwa-glass rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#1e1330]/40">Movement trend</p>
          <h3 className="text-sm font-bold text-[#1e1330]">Last 3 days</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#6b2fa5]">
            <span className="h-2 w-2 rounded-full bg-[#6b2fa5]" /> {totalTickets} tickets
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-cyan-600">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> {totalVotes} votes
          </span>
        </div>
      </div>

      {hasData ? (
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={days} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pwaTicketsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6b2fa5" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6b2fa5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pwaVotesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(107,47,165,0.08)" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#1e133066" }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(107,47,165,0.2)" }} />
              <Area
                type="monotone"
                dataKey="ticketsPurchased"
                stroke="#6b2fa5"
                strokeWidth={2.5}
                fill="url(#pwaTicketsGrad)"
              />
              <Area
                type="monotone"
                dataKey="votesCast"
                stroke="#22d3ee"
                strokeWidth={2.5}
                fill="url(#pwaVotesGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center text-center">
          <p className="text-xs text-[#1e1330]/35">
            No ticket purchases or votes in the last 3 days yet.
          </p>
        </div>
      )}
    </div>
  )
}
