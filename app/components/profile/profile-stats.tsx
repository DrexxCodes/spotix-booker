"use client"

import { Calendar, TrendingUp } from "lucide-react"
import { MaskedAmount } from "@/components/ui/masked-amount"

interface ProfileData {
  eventsCreated: number
  totalRevenue: number
}

interface ProfileStatsProps {
  profileData: ProfileData
}

export function ProfileStats({ profileData }: ProfileStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#6b2fa5]/10 flex items-center justify-center flex-shrink-0">
          <Calendar className="w-5 h-5 text-[#6b2fa5]" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium mb-0.5">Events Created</p>
          <p className="text-2xl font-bold text-[#6b2fa5]">{profileData.eventsCreated}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium mb-0.5">Total Revenue</p>
          <p className="text-xl font-bold text-slate-900 truncate">
            <MaskedAmount
              value={`₦${profileData.totalRevenue.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`}
              size="lg"
              className="text-slate-900"
            />
          </p>
        </div>
      </div>
    </div>
  )
}
