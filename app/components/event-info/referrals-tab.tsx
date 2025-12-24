"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore"
import { Plus, Trash2, X } from "lucide-react"

interface ReferralUsage {
  name: string
  ticketType: string
  purchaseDate: any
}

interface ReferralData {
  code: string
  usages: ReferralUsage[]
  totalTickets: number
}

interface ReferralsTabProps {
  userId: string
  eventId: string
}

export default function ReferralsTab({ userId, eventId }: ReferralsTabProps) {
  const [referralCode, setReferralCode] = useState("")
  const [referrals, setReferrals] = useState<ReferralData[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [selectedReferral, setSelectedReferral] = useState<ReferralData | null>(null)

  // Fetch all referrals
  useEffect(() => {
    const fetchReferrals = async () => {
      setFetching(true)
      try {
        const referralsCollectionRef = collection(db, "events", userId, "userEvents", eventId, "referrals")
        const snapshot = await getDocs(referralsCollectionRef)

        const referralsData: ReferralData[] = []
        snapshot.forEach((docSnap) => {
          const data = docSnap.data()
          referralsData.push({
            code: docSnap.id,
            usages: data.usages || [],
            totalTickets: data.totalTickets || 0,
          })
        })

        setReferrals(referralsData)
      } catch (error) {
        console.error("Error fetching referrals:", error)
      } finally {
        setFetching(false)
      }
    }

    fetchReferrals()
  }, [userId, eventId])

  const handleAddReferral = async () => {
    if (!referralCode.trim()) {
      alert("Please enter a referral code name")
      return
    }

    // Check if referral code already exists
    if (referrals.some((r) => r.code.toLowerCase() === referralCode.toLowerCase())) {
      alert("This referral code already exists")
      return
    }

    setLoading(true)
    try {
      const referralDocRef = doc(db, "events", userId, "userEvents", eventId, "referrals", referralCode)
      await setDoc(referralDocRef, {
        usages: [],
        totalTickets: 0,
      })

      setReferrals([
        ...referrals,
        {
          code: referralCode,
          usages: [],
          totalTickets: 0,
        },
      ])

      setReferralCode("")
      alert("Referral code added successfully!")
    } catch (error) {
      console.error("Error adding referral:", error)
      alert("Failed to add referral code. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteReferral = async (code: string) => {
    if (!confirm(`Are you sure you want to delete the referral code "${code}"?`)) {
      return
    }

    setLoading(true)
    try {
      const referralDocRef = doc(db, "events", userId, "userEvents", eventId, "referrals", code)
      await deleteDoc(referralDocRef)

      setReferrals(referrals.filter((r) => r.code !== code))
      alert("Referral code deleted successfully!")
    } catch (error) {
      console.error("Error deleting referral:", error)
      alert("Failed to delete referral code. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "Unknown"

    if (timestamp && typeof timestamp === "object" && "seconds" in timestamp) {
      try {
        const date = new Date(timestamp.seconds * 1000)
        return date.toLocaleDateString()
      } catch (error) {
        return "Invalid date"
      }
    }

    return String(timestamp)
  }

  return (
    <div className="space-y-6">
      {/* Add Referral Code Section */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">Add Referral Code</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder="Enter referral code name"
            className="w-full sm:flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6b2fa5] focus:border-transparent transition-all"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && referralCode.trim()) {
                handleAddReferral()
              }
            }}
          />
          <button
            onClick={handleAddReferral}
            disabled={loading || !referralCode.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#6b2fa5] text-white rounded-lg hover:bg-[#5a2589] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 font-medium shadow-md hover:shadow-lg"
          >
            <Plus size={18} />
            <span>Add Code</span>
          </button>
        </div>
      </div>

      {/* Referrals Table */}
      <div>
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">Referral Codes</h3>
        {fetching ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#6b2fa5] border-r-transparent mb-4"></div>
            <p className="text-slate-600">Loading referral codes...</p>
          </div>
        ) : referrals.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No referral codes added yet</p>
            <p className="text-slate-500 text-sm mt-2">Create your first referral code to start tracking</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-slate-900">Referral Code</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-slate-900">Uses</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-slate-900">Tickets</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs sm:text-sm font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {referrals.map((referral) => (
                    <tr key={referral.code} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <button
                          onClick={() => setSelectedReferral(referral)}
                          className="font-mono text-sm sm:text-base font-semibold text-[#6b2fa5] hover:underline hover:text-[#5a2589] transition-colors"
                        >
                          {referral.code}
                        </button>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-1 bg-blue-100 text-blue-700 text-xs sm:text-sm font-semibold rounded-full">
                          {referral.usages.length}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-1 bg-green-100 text-green-700 text-xs sm:text-sm font-semibold rounded-full">
                          {referral.totalTickets}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteReferral(referral.code)}
                          disabled={loading}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                          title="Delete referral code"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal/Popup for Referral Details */}
      {selectedReferral && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">Referral Code</h3>
                <span className="font-mono text-lg sm:text-xl font-bold text-[#6b2fa5] mt-1 block">{selectedReferral.code}</span>
              </div>
              <button
                onClick={() => setSelectedReferral(null)}
                className="p-2 text-slate-500 hover:bg-white hover:text-slate-700 rounded-lg transition-all active:scale-95"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-100px)]">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 shadow-sm">
                  <p className="text-xs sm:text-sm text-blue-700 font-medium mb-1">Total Uses</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-900">{selectedReferral.usages.length}</p>
                </div>
                <div className="bg-gradient-to-br from-[#6b2fa5]/10 to-[#6b2fa5]/20 rounded-xl p-4 border border-[#6b2fa5]/30 shadow-sm">
                  <p className="text-xs sm:text-sm text-[#6b2fa5] font-medium mb-1">Tickets Sold</p>
                  <p className="text-2xl sm:text-3xl font-bold text-[#6b2fa5]">{selectedReferral.totalTickets}</p>
                </div>
              </div>

              {/* Usage Details */}
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-4">Usage Details</h4>
                {selectedReferral.usages.length === 0 ? (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <Plus size={32} className="text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium">No usage yet</p>
                    <p className="text-slate-500 text-sm mt-2">This referral code hasn't been used</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                          <tr>
                            <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-slate-900">Name</th>
                            <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-slate-900">Ticket Type</th>
                            <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-slate-900">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedReferral.usages.map((usage, index) => (
                            <tr key={index} className="hover:bg-slate-50 transition-colors">
                              <td className="px-3 sm:px-4 py-3 text-slate-700 text-sm sm:text-base font-medium">{usage.name}</td>
                              <td className="px-3 sm:px-4 py-3">
                                <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 text-xs sm:text-sm rounded-full font-medium">
                                  {usage.ticketType}
                                </span>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-slate-600 text-xs sm:text-sm">{formatDate(usage.purchaseDate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}