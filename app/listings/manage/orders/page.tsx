"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { tryRefreshTokens, getAccessToken, authFetch } from "@/lib/auth-client"
import { Package, ShoppingBag, AlertCircle, ArrowRight, Image as ImageIcon } from "lucide-react"
import { useListings } from "@/hooks/use-listings"
import Image from "next/image"

export default function OrdersPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { listings, loadListings } = useListings()

  useEffect(() => {
    async function init() {
      try {
        let token = getAccessToken()
        if (!token) {
          const ok = await tryRefreshTokens()
          if (!ok) { router.push("/login"); return }
        }
        const res = await authFetch("/api/user/me")
        if (!res.ok) { router.push("/login"); return }
        const me = await res.json()
        const uid = me.uid ?? me.userId ?? me.id ?? ""
        if (!uid) { router.push("/login"); return }
        setUserId(uid)
        loadListings(uid)
      } catch {
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router, loadListings])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-[#6b2fa5]/20 border-t-[#6b2fa5] rounded-full animate-spin" />
          <Package className="w-5 h-5 text-[#6b2fa5] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="mt-4 text-slate-500 text-sm font-medium">Loading your listings...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Notice banner */}
        <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Heads up — orders are usually accessed via the{" "}
              <button
                onClick={() => router.push("/listings/manage")}
                className="font-semibold underline hover:text-[#6b2fa5] transition-colors"
              >
                Manage Listings
              </button>{" "}
              page. Here are all your listings for quick access.
            </p>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-5 h-5 text-[#6b2fa5]" />
              <span className="text-xs font-semibold text-[#6b2fa5] uppercase tracking-wider">
                {listings.length} {listings.length === 1 ? "Listing" : "Listings"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Orders</h1>
            <p className="text-slate-500 text-sm mt-1">Select a listing to view its orders</p>
          </div>

          <button
            onClick={() => router.push("/listings/manage")}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 bg-white hover:border-[#6b2fa5] hover:text-[#6b2fa5] text-slate-700 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm self-start sm:self-auto"
          >
            <Package className="w-4 h-4" />
            Manage Listings
          </button>
        </div>

        {/* Listings grid */}
        {listings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center animate-in zoom-in-95 fade-in duration-500">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-100 rounded-2xl mb-4">
              <Package className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No Listings Yet</h3>
            <p className="text-slate-500 text-sm mb-5 max-w-xs mx-auto">
              Create your first listing to start receiving orders.
            </p>
            <button
              onClick={() => router.push("/listings")}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6b2fa5] hover:bg-[#5a2589] text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm"
            >
              <Package className="w-4 h-4" />
              Create Listing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-500">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-[#6b2fa5]/30 hover:shadow-lg hover:shadow-[#6b2fa5]/5 transition-all duration-200"
              >
                {/* Image */}
                {listing.images && listing.images.length > 0 ? (
                  <div className="relative w-full h-44 bg-slate-100 overflow-hidden">
                    <Image
                      src={listing.images[0] || "/placeholder.svg"}
                      alt={listing.productName}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="w-full h-44 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-slate-300" />
                  </div>
                )}

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-bold text-slate-900 mb-1 truncate">{listing.productName}</h3>
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{listing.description}</p>

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Price</p>
                      <p className="text-lg font-bold text-[#6b2fa5]">
                        ₦{listing.price?.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/listings/manage/orders/${listing.id}`)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#6b2fa5] hover:bg-[#5a2589] text-white rounded-lg font-semibold text-sm transition-all duration-200"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    View Orders
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
