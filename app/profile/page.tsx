"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import { Loader } from "lucide-react"
import { ProfileHeader } from "@/components/profile/profile-header"
import { ProfileStats } from "@/components/profile/profile-stats"
import { CollaborationsSection } from "@/components/profile/collaborations-section"
import { PersonalInformation } from "@/components/profile/personal-information"
import { PayoutMethodsSection } from "@/components/profile/payout-methods-section"

export interface PayoutMethod {
  id: string
  accountName: string
  accountNumber: string
  bankName: string
  bankCode: string
  primary: boolean
  recipientCode?: string
  createdAt: string
}

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
  enabledCollaboration?: boolean
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading]           = useState(true)
  const [profileData, setProfileData]   = useState<ProfileData | null>(null)
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([])
  const [authChecked, setAuthChecked]   = useState(false)

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        let token = getAccessToken()
        if (!token) {
          const refreshed = await tryRefreshTokens()
          if (!refreshed) { router.push("/login"); return }
          token = getAccessToken()
        }
        if (!token) { router.push("/login"); return }

        const userResponse = await authFetch("/api/user/me")
        if (!userResponse.ok) { router.push("/login"); return }

        const userData = await userResponse.json()
        const userId = userData?.uid || userData?.id
        if (!userId) { router.push("/login"); return }

        // Parallel: stats, bvt, payout methods
        const [bvtResponse, statsResponse, methodsResponse] = await Promise.all([
          authFetch(`/api/profile/bvt?userId=${userId}`),
          authFetch(`/api/profile/stats?userId=${userId}`),
          authFetch("/api/payout/method"),
        ])

        const bvtData    = bvtResponse.ok    ? await bvtResponse.json()    : {}
        const statsData  = statsResponse.ok  ? await statsResponse.json()  : {}
        const methodsData = methodsResponse.ok ? await methodsResponse.json() : { methods: [] }

        setPayoutMethods(methodsData.methods ?? [])

        setProfileData({
          uid:                 userId,
          username:            userData.username     || "",
          email:               userData.email        || "",
          fullName:            userData.fullName     || "",
          profilePicture:      userData.profilePicture || "/placeholder.svg",
          bookerName:          userData.bookerName   || userData.fullName || "",
          dateOfBirth:         userData.dateOfBirth  || "",
          eventsCreated:       statsData.eventsCreated || 0,
          totalRevenue:        statsData.totalRevenue  || 0,
          joinDate:            userData.createdAt    || new Date().toISOString(),
          isVerified:          userData.isVerified   || false,
          bvt:                 bvtData.bvt            || "",
          enabledCollaboration: userData.enabledCollaboration || false,
        })

        setAuthChecked(true)
      } catch (err) {
        console.error("Profile load error:", err)
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }

    loadProfileData()
  }, [router])

  // Same in-flow (not full-viewport) loading pattern as the Polls page —
  // no fixed white overlay covering the nav, which was the main source of
  // this route "feeling like" a full page reload on every visit.
  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader className="w-7 h-7 animate-spin text-[#6b2fa5]" />
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {profileData && (
            <>
              <div className="mb-6">
                <ProfileHeader profileData={profileData} />
              </div>

              {/* Two-column layout on large screens: a sidebar for at-a-glance
                  info (stats, payout methods) and a wider main column for
                  everything else. Stacks into a single column below lg.
                  Telegram/Zoom/Google Meet now live on /integrations. */}
              <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6 lg:items-start">
                <div className="space-y-6 mb-6 lg:mb-0">
                  <ProfileStats profileData={profileData} />
                  <PayoutMethodsSection methods={payoutMethods} />
                </div>

                <div className="space-y-6 min-w-0">
                  <CollaborationsSection profileData={profileData} />
                  <PersonalInformation profileData={profileData} />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}
