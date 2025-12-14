"use client"

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface ChartsSectionProps {
  ticketSalesByDay: any[]
  ticketTypeData: any[]
  ticketSalesByType: any[]
  eventData: any
}

export default function ChartsSection({
  ticketSalesByDay,
  ticketTypeData,
  ticketSalesByType,
  eventData,
}: ChartsSectionProps) {
  return (
    <div className="space-y-8">
      {/* Sales Over Time */}
      <div className="bg-white rounded-lg border border-purple-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Ticket Sales Over Time</h3>
        {ticketSalesByDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={ticketSalesByDay} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6b2fa5" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6b2fa5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
              <XAxis dataKey="date" stroke="#999" />
              <YAxis stroke="#999" />
              <Tooltip
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e9d5ff", borderRadius: "8px" }}
                cursor={{ stroke: "#6b2fa5", strokeWidth: 2 }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="count"
                name="Tickets Sold"
                stroke="#6b2fa5"
                fillOpacity={1}
                fill="url(#colorCount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-500 py-12">No sales data available yet.</p>
        )}
      </div>

      {/* Ticket Types */}
      <div className="bg-white rounded-lg border border-purple-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Ticket Types</h3>

        {/* Chart */}
        {ticketTypeData.length > 0 ? (
          <div className="mb-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ticketTypeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
                <XAxis dataKey="type" stroke="#999" />
                <YAxis stroke="#999" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e9d5ff", borderRadius: "8px" }}
                  cursor={{ fill: "#f3e8ff" }}
                />
                <Legend />
                <Bar dataKey="count" name="Tickets Sold" fill="#6b2fa5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-12">No ticket type data available yet.</p>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-purple-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Price</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Sold</th>
              </tr>
            </thead>
            <tbody>
              {eventData.isFree ? (
                <tr className="border-b border-gray-200 hover:bg-purple-50">
                  <td className="py-3 px-4 text-gray-700">Free Admission</td>
                  <td className="py-3 px-4 text-gray-700">₦0.00</td>
                  <td className="py-3 px-4 text-gray-700 font-semibold">{eventData.ticketsSold}</td>
                </tr>
              ) : (
                eventData.ticketPrices.map((ticket: any, index: number) => {
                  const typeData = ticketSalesByType.find((t) => t.type === ticket.policy)
                  const soldCount = typeData ? typeData.count : 0

                  return (
                    <tr key={index} className="border-b border-gray-200 hover:bg-purple-50">
                      <td className="py-3 px-4 text-gray-700">{ticket.policy}</td>
                      <td className="py-3 px-4 text-gray-700">
                        ₦{Number.parseFloat(ticket.price.toString()).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-gray-700 font-semibold">{soldCount}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
