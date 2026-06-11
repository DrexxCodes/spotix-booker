"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import { waitForAuthInit } from "@/hooks/useAuth"
import Link from "next/link"
import { CreateListingForm } from "@/components/listings/create-listing-form"
import { Package, ArrowRight, Image as ImageIcon, Zap, Lock } from "lucide-react"

export default function ListingsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const router = useRouter()

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
        console.error("Listings auth error:", err)
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
          <p className="text-sm text-slate-500">Loading your store…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6b2fa5] mb-1">Merchandise</p>
              <h1 className="text-2xl font-bold text-slate-900">Create a Listing</h1>
              <p className="text-sm text-slate-500 mt-1">Add products your attendees can browse and buy.</p>
            </div>
            <Link
              href="/listings/manage"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-[#6b2fa5]/40 hover:text-[#6b2fa5] transition-all shadow-sm group whitespace-nowrap"
            >
              <Package size={15} />
              Manage Listings
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Feature tiles */}
        {/* <div className="grid sm:grid-cols-3 gap-3 mb-8">
          {[
            { icon: ImageIcon, color: "bg-blue-50 text-blue-600", title: "Up to 6 images", desc: "Showcase your product from every angle" },
            { icon: Zap,       color: "bg-emerald-50 text-emerald-600", title: "Instant publishing", desc: "Live on your event page immediately" },
            { icon: Lock,      color: "bg-[#6b2fa5]/8 text-[#6b2fa5]",  title: "Private & secure", desc: "Your listings are protected by default" },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="bg-white rounded-xl border border-slate-100 p-4 flex items-start gap-3 shadow-sm">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={16} strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div> */}

        {/* Form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Listing details</h2>
          </div>
          <div className="p-6">
            <CreateListingForm userId={userId || ""} />
          </div>
        </div>

      </div>
    </div>
  )
}
