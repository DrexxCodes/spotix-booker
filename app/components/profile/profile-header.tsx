"use client"

import Image from "next/image"
import { CheckCircle2, Copy, Check, ExternalLink } from "lucide-react"
import { useState } from "react"

interface ProfileData {
  uid: string
  username: string
  email: string
  fullName: string
  profilePicture: string
  bookerName: string
  dateOfBirth: string
  eventsCreated: number
  totalRevenue: number
  joinDate: string
  isVerified: boolean
  bvt?: string
}

interface ProfileHeaderProps {
  profileData: ProfileData
}

/** Parse an ISO string or Firestore serialised timestamp safely */
function parseJoinDate(raw: string): string {
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return "Unknown"
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  } catch {
    return "Unknown"
  }
}

export function ProfileHeader({ profileData }: ProfileHeaderProps) {
  const editProfileUrl = process.env.NEXT_PUBLIC_SPOTIX_USER_URL || "https://spotix.com.ng/profile"
  const [copied, setCopied] = useState(false)

  const handleCopyBVT = async () => {
    if (profileData.bvt) {
      await navigator.clipboard.writeText(profileData.bvt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const joinedLabel = parseJoinDate(profileData.joinDate)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Banner */}
      <div className="h-28 bg-gradient-to-r from-[#6b2fa5] to-[#7c3aed] relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 800 112">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="800" height="112" fill="url(#grid)" />
        </svg>
      </div>

      <div className="px-6 pb-6 -mt-12 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">

          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-slate-100">
              <Image
                src={profileData.profilePicture || "/placeholder.svg"}
                alt={profileData.bookerName}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1 sm:pb-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-900 truncate">{profileData.bookerName}</h1>
              {profileData.isVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  <CheckCircle2 size={12} />
                  Verified
                </span>
              )}
            </div>

            <p className="text-sm text-slate-400 mb-2">@{profileData.username}</p>

            {/* BVT chip — click to copy */}
            {profileData.isVerified && profileData.bvt && (
              <button
                onClick={handleCopyBVT}
                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#6b2fa5]/6 border border-[#6b2fa5]/20 hover:bg-[#6b2fa5]/10 transition-colors mb-2"
              >
                <span className="text-xs font-mono font-semibold text-[#6b2fa5]">{profileData.bvt}</span>
                <span className="text-[10px] text-[#6b2fa5]/60 font-medium">BVT</span>
                {copied
                  ? <Check size={12} className="text-emerald-500" />
                  : <Copy size={12} className="text-[#6b2fa5]/40 group-hover:text-[#6b2fa5]/70 transition-colors" />
                }
              </button>
            )}

            <p className="text-xs text-slate-400">Member since {joinedLabel}</p>
          </div>

          {/* Edit button */}
          <div className="flex-shrink-0 self-start sm:self-end">
            <a
              href={editProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6b2fa5] hover:bg-[#5a2589] text-white text-sm font-semibold transition-colors shadow-sm"
            >
              Edit Profile
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
