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

export function PwaStatsGrid({ stats }: { stats: DashboardStats }) {
  const balanceCtx = useBalanceVisibilityRoot()

  return (
    <BalanceVisibilityCtx.Provider value={balanceCtx}>
      <div className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#1e1330]/40">Overview</p>
          <div className="flex items-center gap-1.5 text-xs text-[#1e1330]/40">
            <span>Balances</span>
            <BalanceToggleButton />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Total Events"
            value={fmt(stats.totalEvents)}
            icon={<Calendar size={15} className="text-[#6b2fa5]" />}
            iconBg="bg-[#6b2fa5]/10"
          />
          <StatCard
            label="Active"
            value={fmt(stats.activeEvents)}
            icon={<TrendingUp size={15} className="text-emerald-600" />}
            iconBg="bg-emerald-50"
            valueColor="text-emerald-700"
          />
          <StatCard
            label="Inactive"
            value={fmt(stats.inactiveEvents)}
            icon={<Calendar size={15} className="text-[#1e1330]/30" />}
            iconBg="bg-[#1e1330]/5"
            valueColor="text-[#1e1330]/60"
          />
          <StatCard
            label="Tickets Sold"
            value={fmt(stats.totalTicketsSold)}
            icon={<Tag size={15} className="text-blue-600" />}
            iconBg="bg-blue-50"
            valueColor="text-blue-700"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FinancialCard
            label="Total Revenue"
            amount={fmtCurrency(stats.totalRevenue)}
            sub="All ticket sales"
            accent="text-[#1e1330]"
            blockKey="revenue"
          />
          <FinancialCard
            label="Available Balance"
            amount={fmtCurrency(stats.availableBalance)}
            sub="Ready to withdraw"
            accent="text-[#6b2fa5]"
            blockKey="balance"
            highlight
          />
          <FinancialCard
            label="Total Paid Out"
            amount={fmtCurrency(stats.totalPaidOut)}
            sub="Withdrawn to date"
            accent="text-emerald-700"
            blockKey="paidOut"
          />
        </div>
      </div>
    </BalanceVisibilityCtx.Provider>
  )
}

function StatCard({
  label,
  value,
  icon,
  iconBg,
  valueColor = "text-[#1e1330]",
}: {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  valueColor?: string
}) {
  return (
    <div className="pwa-glass flex items-center gap-3 rounded-xl p-4 transition-transform hover:-translate-y-0.5">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="mb-1 text-xs font-medium leading-none text-[#1e1330]/40">{label}</p>
        <p className={`text-lg font-bold leading-none ${valueColor}`}>{value}</p>
      </div>
    </div>
  )
}

function FinancialCard({
  label,
  amount,
  sub,
  accent,
  highlight,
  blockKey,
}: {
  label: string
  amount: string
  sub: string
  accent: string
  highlight?: boolean
  blockKey: "revenue" | "balance" | "paidOut"
}) {
  return (
    <div
      className={`rounded-xl p-5 transition-transform hover:-translate-y-0.5 ${
        highlight
          ? "bg-gradient-to-br from-[#6b2fa5] to-[#7c3aed] text-white shadow-lg shadow-purple-900/20"
          : "pwa-glass"
      }`}
    >
      <p
        className={`mb-2 text-xs font-semibold uppercase tracking-wide ${
          highlight ? "text-white/70" : "text-[#1e1330]/40"
        }`}
      >
        {label}
      </p>
      <MaskedAmount
        value={amount}
        size="xl"
        blockKey={blockKey}
        className={highlight ? "text-white" : accent}
        iconClassName={highlight ? "text-white/50 hover:text-white" : ""}
      />
      <p className={`mt-1.5 text-xs ${highlight ? "text-white/60" : "text-[#1e1330]/40"}`}>{sub}</p>
    </div>
  )
}
