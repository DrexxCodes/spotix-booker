"use client"
import { Copy, Check, TrendingUp, Wallet, Users, DollarSign } from "lucide-react"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface OverviewTabProps {
  eventData: any
  availableBalance: number
  totalPaidOut: number
  copiedField: string | null
  bookerBVT: string
  ticketSalesByDay: any[]
  ticketTypeData: any[]
  copyToClipboard: (text: string, field: string) => void
}

export default function OverviewTab({
  eventData,
  availableBalance,
  totalPaidOut,
  copiedField,
  bookerBVT,
  ticketSalesByDay,
  ticketTypeData,
  copyToClipboard,
}: OverviewTabProps) {
  return (
    <div className="space-y-8">
      {/* Hero Image with Gradient Overlay */}
      <div className="relative bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-lg group">
        <div className="absolute inset-0 bg-gradient-to-t from-[#6b2fa5]/80 via-[#6b2fa5]/20 to-transparent z-10" />
        <img
          src={eventData.eventImage || "/placeholder.svg?height=300&width=800&query=event+image"}
          alt={eventData.eventName}
          className="w-full h-96 object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute bottom-0 left-0 right-0 p-8 z-20">
          <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">{eventData.eventName}</h2>
          <p className="text-white/90 drop-shadow-md">
            {new Date(eventData.eventDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>

      {/* Stats Grid - Enhanced with icons and animations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Tickets Sold Stat */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-600 text-sm font-semibold uppercase tracking-wide">Tickets Sold</h3>
            <div className="p-2 bg-[#6b2fa5]/10 rounded-lg">
              <Users className="w-5 h-5 text-[#6b2fa5]" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-2">
            {eventData.ticketsSold}
            {eventData.enableMaxSize && eventData.maxSize && (
              <span className="text-lg text-slate-500 font-medium"> / {eventData.maxSize}</span>
            )}
          </p>
          {eventData.enableMaxSize && eventData.maxSize && (
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#6b2fa5] to-[#8b4fc5] h-2.5 rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{
                  width: `${(eventData.ticketsSold / eventData.maxSize) * 100}%`,
                }}
              />
            </div>
          )}
          {eventData.enableMaxSize && eventData.maxSize && (
            <p className="text-xs text-slate-500 mt-2">
              {((eventData.ticketsSold / eventData.maxSize) * 100).toFixed(1)}% capacity
            </p>
          )}
        </div>

        {/* Revenue Stat */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-600 text-sm font-semibold uppercase tracking-wide">Total Revenue</h3>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">₦{eventData.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">All ticket sales</p>
        </div>

        {/* Available Balance Stat - Highlighted */}
        <div className="bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-xl p-6 border border-[#6b2fa5] shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white/90 text-sm font-semibold uppercase tracking-wide">Available Balance</h3>
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Wallet className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">₦{availableBalance.toLocaleString()}</p>
          <p className="text-xs text-white/80 mt-2">Ready to withdraw</p>
        </div>

        {/* Paid Out Stat */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-600 text-sm font-semibold uppercase tracking-wide">Total Paid Out</h3>
            <div className="p-2 bg-blue-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900">₦{totalPaidOut.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">Withdrawn to date</p>
        </div>
      </div>

      {/* Available Tickets - Enhanced Cards */}
      {eventData.ticketPrices && eventData.ticketPrices.length > 0 && (
        <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Available Tickets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eventData.ticketPrices.map((ticket: any, index: number) => (
              <div
                key={index}
                className="group relative flex items-center justify-between p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200 hover:border-[#6b2fa5] hover:shadow-md transition-all duration-300 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#6b2fa5]/0 to-[#6b2fa5]/0 group-hover:from-[#6b2fa5]/5 group-hover:to-[#6b2fa5]/10 transition-all duration-300" />
                <div className="flex-1 relative z-10">
                  <p className="font-bold text-slate-900 text-lg mb-1">{ticket.policy || `Ticket Type ${index + 1}`}</p>
                  <p className="text-sm text-slate-600">Price per ticket</p>
                </div>
                <div className="text-right relative z-10">
                  <p className="text-2xl font-bold text-[#6b2fa5] group-hover:scale-110 transition-transform duration-300">
                    ₦{Number(ticket.price).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">Per ticket</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Requisites - Enhanced with better visual hierarchy */}
      <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-6">Payment Requisites</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Event ID Field */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wide">Event ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={eventData.id}
                readOnly
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-transparent transition-all"
              />
              <button
                onClick={() => copyToClipboard(eventData.id, "eventId")}
                className="p-3 hover:bg-[#6b2fa5]/10 rounded-lg transition-all duration-200 text-slate-600 hover:text-[#6b2fa5] border border-slate-200 hover:border-[#6b2fa5]"
              >
                {copiedField === "eventId" ? (
                  <Check size={20} className="text-emerald-600" />
                ) : (
                  <Copy size={20} />
                )}
              </button>
            </div>
          </div>

          {/* Pay ID Field */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wide">Pay ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={eventData.payId || "Not set"}
                readOnly
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-transparent transition-all"
              />
              <button
                onClick={() => copyToClipboard(eventData.payId || "", "payId")}
                className="p-3 hover:bg-[#6b2fa5]/10 rounded-lg transition-all duration-200 text-slate-600 hover:text-[#6b2fa5] border border-slate-200 hover:border-[#6b2fa5]"
              >
                {copiedField === "payId" ? (
                  <Check size={20} className="text-emerald-600" />
                ) : (
                  <Copy size={20} />
                )}
              </button>
            </div>
          </div>

          {/* BVT Field */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wide">BVT</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={bookerBVT || "Not verified"}
                readOnly
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-transparent transition-all"
              />
              <button
                onClick={() => copyToClipboard(bookerBVT || "", "bvt")}
                className="p-3 hover:bg-[#6b2fa5]/10 rounded-lg transition-all duration-200 text-slate-600 hover:text-[#6b2fa5] border border-slate-200 hover:border-[#6b2fa5]"
              >
                {copiedField === "bvt" ? (
                  <Check size={20} className="text-emerald-600" />
                ) : (
                  <Copy size={20} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Event Description - Enhanced readability */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-8 border border-slate-200 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-4">Event Description</h3>
        <p className="text-slate-700 leading-relaxed text-base">{eventData.eventDescription}</p>
      </div>

      {/* Charts Section - Enhanced styling */}
      {ticketTypeData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ticket Sales Chart */}
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            <h4 className="text-xl font-bold text-slate-900 mb-6">Ticket Sales Over Time</h4>
            {ticketSalesByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={ticketSalesByDay}>
                  <defs>
                    <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6b2fa5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6b2fa5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b" 
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    name="Tickets Sold" 
                    stroke="#6b2fa5" 
                    strokeWidth={3}
                    fill="url(#colorTickets)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center py-20">
                <p className="text-slate-500 text-center">No sales data available yet</p>
              </div>
            )}
          </div>

          {/* Ticket Types Chart */}
          <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            <h4 className="text-xl font-bold text-slate-900 mb-6">Ticket Types Distribution</h4>
            {ticketTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={ticketTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="type" 
                    stroke="#64748b" 
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#6b2fa5" 
                    name="Tickets Sold" 
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center py-20">
                <p className="text-slate-500 text-center">No ticket type data available</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}