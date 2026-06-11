"use client"

import { CheckCircle2, CreditCard, Building2 } from "lucide-react"
import type { PayoutMethod } from "@/app/profile/page"

interface PayoutMethodsSectionProps {
  methods: PayoutMethod[]
}

export function PayoutMethodsSection({ methods }: PayoutMethodsSectionProps) {
  return (
    <section>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

        {/* Section header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[#6b2fa5]/10 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-4 h-4 text-[#6b2fa5]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Payout Accounts</h2>
            <p className="text-xs text-slate-400">Bank accounts registered for receiving payouts</p>
          </div>
          {methods.length > 0 && (
            <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#6b2fa5]/10 text-[#6b2fa5] text-[11px] font-bold">
              {methods.length}
            </span>
          )}
        </div>

        {methods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <Building2 className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No payout accounts yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Add a bank account from the Payouts section to receive withdrawals.
            </p>
          </div>
        ) : (
          /* Scrollable row — hidden scrollbar, drag/swipe friendly */
          <div
            className="flex gap-3 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {methods.map((method) => (
              <PayoutCard key={method.id} method={method} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function PayoutCard({ method }: { method: PayoutMethod }) {
  const hasBeenUsed = Boolean(method.recipientCode)

  return (
    <div
      className={`
        relative flex-shrink-0 w-64 rounded-xl border p-4
        transition-all duration-200
        ${method.primary
          ? "border-[#6b2fa5]/30 bg-gradient-to-br from-[#6b2fa5]/[0.04] to-[#6b2fa5]/[0.02] shadow-sm"
          : "border-slate-200 bg-slate-50/60"
        }
      `}
    >
      {/* Primary badge */}
      {method.primary && (
        <span className="absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded-full bg-[#6b2fa5] text-white text-[10px] font-bold tracking-wide">
          Primary
        </span>
      )}

      {/* Bank icon */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
        method.primary ? "bg-[#6b2fa5]/15" : "bg-slate-200/60"
      }`}>
        <Building2 className={`w-5 h-5 ${method.primary ? "text-[#6b2fa5]" : "text-slate-400"}`} />
      </div>

      {/* Account name */}
      <p className="text-sm font-bold text-slate-900 leading-tight mb-0.5 pr-14 truncate">
        {method.accountName}
      </p>

      {/* Account number — monospace */}
      <p className="text-xs font-mono text-slate-500 mb-1">{method.accountNumber}</p>

      {/* Bank name */}
      <p className="text-xs text-slate-400 truncate">{method.bankName}</p>

      {/* Has-been-used tick */}
      {hasBeenUsed && (
        <div className="mt-3 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          <span className="text-[11px] text-emerald-600 font-medium">Used for payouts</span>
        </div>
      )}
    </div>
  )
}
