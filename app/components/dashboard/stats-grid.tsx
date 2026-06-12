"use client"

import { Calendar, TrendingUp, Tag } from "lucide-react"
import { MaskedAmount, BalanceToggleButton } from "@/components/ui/masked-amount"
import { useBalanceVisibilityRoot, BalanceVisibilityCtx } from "@/hooks/use-balance-visibility"

interface DashboardStats {
  totalEvents: number
  activeEvents: number
  inactiveEvents: number
  totalRevenue: number
  availableBalance: number
  totalPaidOut: number
  totalTicketsSold: number
}

function fmt(n: number) {
  return n.toLocaleString()
}
function fmtCurrency(n: number) {
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function StatsGrid({ stats }: { stats: DashboardStats }) {
  const balanceCtx = useBalanceVisibilityRoot()

  return (
    <BalanceVisibilityCtx.Provider value={balanceCtx}>
      <div className="space-y-3">

        {/* Section label + global toggle */}
        <div className="flex items-center justify-between px-0.5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overview</p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Balances</span>
            <BalanceToggleButton />
          </div>
        </div>

        {/* Row 1: counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Events"
            value={fmt(stats.totalEvents)}
            icon={<Calendar size={15} className="text-[#6b2fa5]" />}
            iconBg="bg-[#6b2fa5]/10"
            valueColor="text-slate-900"
            delay="delay-[0ms]"
          />
          <StatCard
            label="Active"
            value={fmt(stats.activeEvents)}
            icon={<TrendingUp size={15} className="text-emerald-600" />}
            iconBg="bg-emerald-50"
            valueColor="text-emerald-700"
            delay="delay-[50ms]"
          />
          <StatCard
            label="Inactive"
            value={fmt(stats.inactiveEvents)}
            icon={<Calendar size={15} className="text-slate-400" />}
            iconBg="bg-slate-100"
            valueColor="text-slate-600"
            delay="delay-[100ms]"
          />
          <StatCard
            label="Tickets Sold"
            value={fmt(stats.totalTicketsSold)}
            icon={<Tag size={15} className="text-blue-600" />}
            iconBg="bg-blue-50"
            valueColor="text-blue-700"
            delay="delay-[150ms]"
          />
        </div>

        {/* Row 2: financials — each has its own blockKey for independent toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FinancialCard
            label="Total Revenue"
            amount={fmtCurrency(stats.totalRevenue)}
            sub="All ticket sales"
            accent="text-slate-900"
            blockKey="revenue"
            delay="delay-[200ms]"
          />
          <FinancialCard
            label="Available Balance"
            amount={fmtCurrency(stats.availableBalance)}
            sub="Ready to withdraw"
            accent="text-[#6b2fa5]"
            blockKey="balance"
            highlight
            delay="delay-[250ms]"
          />
          <FinancialCard
            label="Total Paid Out"
            amount={fmtCurrency(stats.totalPaidOut)}
            sub="Withdrawn to date"
            accent="text-emerald-700"
            blockKey="paidOut"
            delay="delay-[300ms]"
          />
        </div>
      </div>
    </BalanceVisibilityCtx.Provider>
  )
}

function StatCard({
  label, value, icon, iconBg, valueColor, delay,
}: {
  label: string; value: string; icon: React.ReactNode
  iconBg: string; valueColor: string; delay: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${delay}`}>
      <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium leading-none mb-1">{label}</p>
        <p className={`text-lg font-bold leading-none ${valueColor}`}>{value}</p>
      </div>
    </div>
  )
}

function FinancialCard({
  label, amount, sub, accent, highlight, blockKey, delay,
}: {
  label: string; amount: string; sub: string
  accent: string; highlight?: boolean
  blockKey: "revenue" | "balance" | "paidOut"
  delay: string
}) {
  return (
    <div
      className={`rounded-xl border shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${delay} ${
        highlight
          ? "bg-gradient-to-br from-[#6b2fa5] to-[#7c3aed] border-[#6b2fa5]/30 text-white"
          : "bg-white border-slate-200"
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${highlight ? "text-white/70" : "text-slate-400"}`}>
        {label}
      </p>
      <MaskedAmount
        value={amount}
        size="xl"
        blockKey={blockKey}
        className={highlight ? "text-white" : accent}
        iconClassName={highlight ? "text-white/50 hover:text-white" : ""}
      />
      <p className={`text-xs mt-1.5 ${highlight ? "text-white/60" : "text-slate-400"}`}>{sub}</p>
    </div>
  )
}
