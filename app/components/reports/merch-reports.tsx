"use client"

import { useEffect, useState } from "react"
import { collection, getDocs, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { AlertCircle, CheckCircle, Clock, ChevronRight, ArrowLeft, Search, Filter, Package } from "lucide-react"

interface Report {
  id: string
  username: string
  date: Timestamp | string
  reportTopic: string
  reportHeading: string
  status: "unresolved" | "pending" | "settled"
}

interface MerchReportsComponentProps {
  userId: string
}

export function MerchReportsComponent({ userId }: MerchReportsComponentProps) {
  const [merchIds, setMerchIds] = useState<string[]>([])
  const [selectedMerchId, setSelectedMerchId] = useState<string | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [filteredReports, setFilteredReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "unresolved" | "pending" | "settled">("all")
  const [topicFilter, setTopicFilter] = useState<string>("all")
  const [availableTopics, setAvailableTopics] = useState<string[]>([])

  // Fetch all merch IDs
  useEffect(() => {
    const fetchMerchIds = async () => {
      try {
        const merchCollectionRef = collection(db, "reports", userId, "merch")
        const merchSnapshot = await getDocs(merchCollectionRef)

        const ids: string[] = []
        merchSnapshot.forEach((doc) => {
          ids.push(doc.id)
        })

        setMerchIds(ids)
      } catch (error) {
        console.error("Error fetching merch IDs:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMerchIds()
  }, [userId])

  // Fetch reports for selected merch
  useEffect(() => {
    if (!selectedMerchId) return

    const fetchReports = async () => {
      setLoading(true)
      try {
        const reportsCollectionRef = collection(db, "reports", userId, "merch", selectedMerchId, "reports")
        const reportsSnapshot = await getDocs(reportsCollectionRef)

        const reportsData: Report[] = []
        const topics = new Set<string>()
        
        reportsSnapshot.forEach((doc) => {
          const data = doc.data()
          const report: Report = {
            id: doc.id,
            username: data.username || "Anonymous",
            date: data.date || Timestamp.now(),
            reportTopic: data.reportTopic || "N/A",
            reportHeading: data.reportHeading || "No heading",
            status: data.status || "unresolved",
          }
          reportsData.push(report)
          
          if (report.reportTopic !== "N/A") {
            topics.add(report.reportTopic)
          }
        })

        // Sort by date (newest first)
        reportsData.sort((a, b) => {
          const dateA = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date)
          const dateB = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date)
          return dateB.getTime() - dateA.getTime()
        })

        setReports(reportsData)
        setFilteredReports(reportsData)
        setAvailableTopics(Array.from(topics))
      } catch (error) {
        console.error("Error fetching reports:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [userId, selectedMerchId])

  // Apply filters
  useEffect(() => {
    let filtered = [...reports]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (report) =>
          report.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          report.reportHeading.toLowerCase().includes(searchQuery.toLowerCase()) ||
          report.reportTopic.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((report) => report.status === statusFilter)
    }

    // Topic filter
    if (topicFilter !== "all") {
      filtered = filtered.filter((report) => report.reportTopic === topicFilter)
    }

    setFilteredReports(filtered)
  }, [searchQuery, statusFilter, topicFilter, reports])

  const formatDate = (date: Timestamp | string) => {
    try {
      const dateObj = date instanceof Timestamp ? date.toDate() : new Date(date)
      return dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (error) {
      return "Invalid date"
    }
  }

  const getStatusBadge = (status: "unresolved" | "pending" | "settled") => {
    switch (status) {
      case "unresolved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-700 ring-1 ring-red-600/20">
            <AlertCircle size={14} />
            Unresolved
          </span>
        )
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-600/20">
            <Clock size={14} />
            Pending
          </span>
        )
      case "settled":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
            <CheckCircle size={14} />
            Settled
          </span>
        )
    }
  }

  const resetFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setTopicFilter("all")
  }

  if (loading && !selectedMerchId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-[#6b2fa5]/30 border-t-[#6b2fa5] rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Loading merchandise...</p>
      </div>
    )
  }

  if (merchIds.length === 0) {
    return (
      <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-purple-50/30 rounded-2xl border-2 border-dashed border-slate-200">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Reports Found</h3>
        <p className="text-slate-600">There are no merchandise reports at the moment.</p>
      </div>
    )
  }

  // Show list of merch IDs
  if (!selectedMerchId) {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-10 h-10 bg-[#6b2fa5]/10 rounded-lg">
            <Package className="w-5 h-5 text-[#6b2fa5]" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900">Select a Merchandise</h2>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {merchIds.map((merchId) => (
            <button
              key={merchId}
              onClick={() => setSelectedMerchId(merchId)}
              className="group flex items-center justify-between p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-[#6b2fa5] hover:shadow-xl hover:shadow-[#6b2fa5]/10 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex-1 text-left">
                <p className="font-bold text-slate-900 group-hover:text-[#6b2fa5] transition-colors mb-1">
                  Merch ID
                </p>
                <p className="text-sm text-slate-500 font-mono truncate">{merchId}</p>
                <p className="text-xs text-slate-400 mt-2">Click to view reports</p>
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-[#6b2fa5] transition-all duration-300 group-hover:translate-x-1" size={24} />
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Show reports for selected merch
  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => {
            setSelectedMerchId(null)
            resetFilters()
          }}
          className="group inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:text-[#6b2fa5] bg-white hover:bg-[#6b2fa5]/5 border-2 border-slate-200 hover:border-[#6b2fa5]/30 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md w-fit"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Merchandise
        </button>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-[#6b2fa5]/10 rounded-lg">
            <Filter className="w-5 h-5 text-[#6b2fa5]" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Merchandise Reports</h2>
            <p className="text-sm text-slate-600 font-mono mt-1">ID: {selectedMerchId}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Filters</h3>
          {(searchQuery || statusFilter !== "all" || topicFilter !== "all") && (
            <button
              onClick={resetFilters}
              className="text-sm font-semibold text-[#6b2fa5] hover:text-[#5a2589] transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2.5 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="unresolved">Unresolved</option>
            <option value="pending">Pending</option>
            <option value="settled">Settled</option>
          </select>

          {/* Topic Filter */}
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="px-4 py-2.5 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200 text-slate-900 font-medium"
          >
            <option value="all">All Topics</option>
            {availableTopics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 text-sm text-slate-600 pt-2 border-t border-slate-100">
          <span className="font-semibold text-[#6b2fa5]">{filteredReports.length}</span>
          {filteredReports.length === 1 ? "report" : "reports"} found
        </div>
      </div>

      {/* Reports Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border-2 border-slate-200">
          <div className="w-12 h-12 border-4 border-[#6b2fa5]/30 border-t-[#6b2fa5] rounded-full animate-spin mb-4" />
          <p className="text-slate-600 font-medium">Loading reports...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-purple-50/30 rounded-2xl border-2 border-dashed border-slate-200">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Reports Found</h3>
          <p className="text-slate-600 mb-6">
            {reports.length === 0
              ? "This merchandise has no reports yet."
              : "No reports match your current filters."}
          </p>
          {reports.length > 0 && (
            <button
              onClick={resetFilters}
              className="px-6 py-2.5 bg-[#6b2fa5] hover:bg-[#5a2589] text-white rounded-lg font-semibold transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[#6b2fa5] to-purple-600">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Topic
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Heading
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-[#6b2fa5]/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                      {report.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <span className="inline-flex px-2.5 py-1 bg-slate-100 rounded-md font-medium">
                        {report.reportTopic}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 max-w-xs truncate font-medium">
                      {report.reportHeading}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {formatDate(report.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(report.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}