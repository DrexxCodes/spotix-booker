"use client"

import { User } from "lucide-react"

interface ProfileData {
  fullName: string
  email: string
  dateOfBirth: string
}

interface PersonalInformationProps {
  profileData: ProfileData
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{value || "—"}</span>
    </div>
  )
}

export function PersonalInformation({ profileData }: PersonalInformationProps) {
  return (
    <section>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[#6b2fa5]/10 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-[#6b2fa5]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Personal Information</h2>
            <p className="text-xs text-slate-400">Your Spotix account details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <InfoRow label="Full Name"      value={profileData.fullName} />
          <InfoRow label="Email Address"  value={profileData.email} />
          <InfoRow label="Date of Birth"  value={profileData.dateOfBirth || "Not provided"} />
        </div>
      </div>
    </section>
  )
}
