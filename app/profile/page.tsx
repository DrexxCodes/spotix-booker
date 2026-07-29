"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import { Preloader } from "@/components/preloader"
import { ProfileHeader } from "@/components/profile/profile-header"
import { ProfileStats } from "@/components/profile/profile-stats"
import { VirtualEventsSection } from "@/components/profile/virtual-events-section"
import { CollaborationsSection } from "@/components/profile/collaborations-section"
import { PersonalInformation } from "@/components/profile/personal-information"
import { PayoutMethodsSection } from "@/components/profile/payout-methods-section"
import { TelegramConnect } from "@/components/profile/telegram-connect"
import { MessageSquare } from "lucide-react"

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

  if (!authChecked) return <Preloader isLoading={true} />

  return (
    <>
      <Preloader isLoading={loading} />

      <div className="min-h-screen bg-slate-50">
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {profileData && (
            <>
              <div className="mb-6">
                <ProfileHeader profileData={profileData} />
              </div>

              {/* Two-column layout on large screens: a sidebar for at-a-glance
                  info (stats, payout, telegram) and a wider main column for
                  everything else. Stacks into a single column below lg. */}
              <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6 lg:items-start">
                <div className="space-y-6 mb-6 lg:mb-0">
                  <ProfileStats profileData={profileData} />
                  <PayoutMethodsSection methods={payoutMethods} />

                  {/* Telegram */}
                  <section>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-[#229ED9]/10 flex items-center justify-center">
                          <MessageSquare className="w-4 h-4 text-[#229ED9]" />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-slate-900">Telegram</h2>
                          <p className="text-xs text-slate-400">Receive alerts and manage payouts on the go</p>
                        </div>
                      </div>
                      <TelegramConnect userId={profileData.uid} />
                    </div>
                  </section>
                </div>

                <div className="space-y-6 min-w-0">
                  <VirtualEventsSection profileData={profileData} />
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
