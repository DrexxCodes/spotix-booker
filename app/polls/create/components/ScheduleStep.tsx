"use client"

import { MIN_VOTE_PRICE, MAX_VOTE_PRICE } from "@/lib/poll-config"
import type { PollForm } from "../lib/factories"

interface ScheduleStepProps {
  form: PollForm
  onChange: (updated: PollForm) => void
}

export function ScheduleStep({ form, onChange }: ScheduleStepProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Start Date</label>
          <input type="date" value={form.pollStartDate} onChange={(e) => onChange({ ...form, pollStartDate: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5]" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Start Time</label>
          <input type="time" value={form.pollStartTime} onChange={(e) => onChange({ ...form, pollStartTime: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5]" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">End Date</label>
          <input type="date" value={form.pollEndDate} onChange={(e) => onChange({ ...form, pollEndDate: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5]" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">End Time</label>
          <input type="time" value={form.pollEndTime} onChange={(e) => onChange({ ...form, pollEndTime: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5]" />
        </div>
      </div>

      {form.pollType === "single" && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Price per Vote (₦)</label>
          <input
            type="number"
            placeholder={`0 for free, or ₦${MIN_VOTE_PRICE}–₦${MAX_VOTE_PRICE}`}
            value={form.pollPrice}
            onChange={(e) => onChange({ ...form, pollPrice: Number(e.target.value) })}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-[#6b2fa5]"
          />
          <p className="text-xs text-slate-400 mt-1">Group polls set price per category in the next step.</p>
        </div>
      )}

      <div className="space-y-3">
        <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-slate-900">Buyer bears service fee</p>
            <p className="text-xs text-slate-500">If off, the fee is deducted from your payout instead</p>
          </div>
          <input type="checkbox" checked={form.buyerBearsBurden} onChange={(e) => onChange({ ...form, buyerBearsBurden: e.target.checked })}
            className="w-5 h-5 accent-[#6b2fa5]" />
        </label>
        <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-slate-900">Show live vote counts publicly</p>
            <p className="text-xs text-slate-500">Turn off to hide standings until the poll ends</p>
          </div>
          <input type="checkbox" checked={form.statsVisible} onChange={(e) => onChange({ ...form, statsVisible: e.target.checked })}
            className="w-5 h-5 accent-[#6b2fa5]" />
        </label>
      </div>
    </div>
  )
}
