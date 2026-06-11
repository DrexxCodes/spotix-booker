"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import { waitForAuthInit } from "@/hooks/useAuth"
import { MerchReportsComponent } from "@/components/reports/merch-reports"
import { EventReportsComponent } from "@/components/reports/event-reports"
import { Calendar, Package } from "lucide-react"

export default function ReportsPage() {
  const router = useRouter()
  const [userId, setUserId]     = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<"events" | "merch">("events")

  useEffect(() => {
    const init = async () => {
      try {
        await waitForAuthInit()

        let token = getAccessToken()
        if (!token) {
          const refreshed = await tryRefreshTokens()
          if (!refreshed) { router.push("/login"); return }
          token = getAccessToken()
        }
        if (!token) { router.push("/login"); return }

        const res = await authFetch("/api/user/me")
        if (!res.ok) { router.push("/login"); return }

        const data = await res.json()
        const uid  = data?.uid ?? data?.id
        if (!uid)  { router.push("/login"); return }

        setUserId(uid)
      } catch (err) {
        console.error("Reports auth error:", err)
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#6b2fa5]/30 border-t-[#6b2fa5] rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading reports…</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: "events" as const, label: "Event Reports", icon: Calendar },
    { id: "merch"  as const, label: "Merch Reports",  icon: Package  },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6b2fa5] mb-1">Analytics</p>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">View sales and performance data across your events and merchandise.</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b border-slate-200 mb-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                border-b-2 transition-all duration-150 -mb-px
                ${activeTab === id
                  ? "border-[#6b2fa5] text-[#6b2fa5]"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }
              `}
            >
              <Icon size={15} strokeWidth={activeTab === id ? 2.2 : 1.8} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {userId && (
          <div className="animate-in fade-in duration-300">
            {activeTab === "events" && <EventReportsComponent userId={userId} />}
            {activeTab === "merch"  && <MerchReportsComponent userId={userId} />}
          </div>
        )}

      </div>
    </div>
  )
}
