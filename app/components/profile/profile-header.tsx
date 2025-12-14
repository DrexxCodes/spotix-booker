"use client"

import Image from "next/image"
import { CheckCircle, Copy, Check } from "lucide-react"
import { useState } from "react"

interface ProfileData {
  uid: string
  username: string
  email: string
  fullName: string
  profilePicture: string
  bookerName: string
  dateOfBirth: string
  accountName: string
  accountNumber: string
  bankName: string
  eventsCreated: number
  totalRevenue: number
  joinDate: string
  isVerified: boolean
  bvt?: string
}

interface ProfileHeaderProps {
  profileData: ProfileData
}

export function ProfileHeader({ profileData }: ProfileHeaderProps) {
  const editProfileUrl = process.env.NEXT_PUBLIC_SPOTIX_USER_URL || "https://spotix.com/profile/edit"
  const [copied, setCopied] = useState(false)

  const handleCopyBVT = async () => {
    if (profileData.bvt) {
      await navigator.clipboard.writeText(profileData.bvt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="mb-8 bg-white rounded-2xl shadow-md overflow-hidden">
      {/* Purple gradient header background */}
      <div className="h-32 bg-gradient-to-r from-[#6b2fa5] to-[#5a2589] relative">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 1000 200">
            <defs>
              <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="1000" height="200" fill="url(#grid)" />
          </svg>
        </div>
      </div>

      {/* Profile content */}
      <div className="px-6 pb-6 -mt-16 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          {/* Profile image */}
          <div className="flex-shrink-0">
            <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-background">
              <Image
                src={profileData.profilePicture || "/placeholder.svg?height=128&width=128"}
                alt={profileData.bookerName}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          {/* Profile info */}
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-3xl font-bold text-black sm:text-white">{profileData.bookerName}</h1>
              {profileData.isVerified && (
                <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full">
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">Verified</span>
                </div>
              )}
            </div>
            <p className="text-black sm:text-white mb-3">@{profileData.username}</p>

            {/* BVT - only shown if verified */}
            {profileData.isVerified && profileData.bvt && (
              <div
                onClick={handleCopyBVT}
                className="mb-3 p-2 bg-purple-50 border border-[#6b2fa5] rounded-lg cursor-pointer hover:bg-purple-100 transition-colors"
              >
                <p className="text-xs font-medium text-[#6b2fa5] mb-1">Booker Verification Tag (BVT) - Click to copy</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-mono font-bold text-[#6b2fa5]">{profileData.bvt}</p>
                  {copied ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <Copy size={16} className="text-[#6b2fa5]" />
                  )}
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Joined {new Date(profileData.joinDate).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
            </p>
          </div>

          {/* Edit button */}
          <div className="flex-shrink-0">
            <a
              href={editProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-2 bg-[#6b2fa5] text-white rounded-lg font-medium hover:bg-[#5a2589] transition-colors"
            >
              Edit Profile
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
