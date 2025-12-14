"use client"

import type React from "react"
import { Tag, Percent, DollarSign, Users, Power, Ticket, TrendingUp } from "lucide-react"

interface DiscountData {
  code: string
  type: "percentage" | "flat"
  value: number
  maxUses: number
  usedCount: number
  active: boolean
}

interface DiscountsTabProps {
  discounts: DiscountData[]
  newDiscount: any
  handleDiscountInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  handleAddDiscount: () => void
  handleToggleDiscountStatus: (index: number) => void
}

export default function DiscountsTab({
  discounts,
  newDiscount,
  handleDiscountInputChange,
  handleAddDiscount,
  handleToggleDiscountStatus,
}: DiscountsTabProps) {
  const activeDiscounts = discounts.filter(d => d.active).length
  const totalUsage = discounts.reduce((sum, d) => sum + d.usedCount, 0)

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-xl p-5 text-white shadow-lg shadow-[#6b2fa5]/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-100">Total Codes</p>
              <p className="text-3xl font-bold mt-1">{discounts.length}</p>
            </div>
            <Ticket size={32} className="text-purple-200" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Active Codes</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{activeDiscounts}</p>
            </div>
            <Power size={32} className="text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Usage</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{totalUsage}</p>
            </div>
            <TrendingUp size={32} className="text-blue-500" />
          </div>
        </div>
      </div>

      {/* Create Discount Form */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-gradient-to-br from-[#6b2fa5] to-[#8b4fc5] rounded-lg">
            <Tag size={20} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Create New Discount Code</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Tag size={16} className="text-[#6b2fa5]" />
              Discount Code
            </label>
            <input
              type="text"
              name="code"
              value={newDiscount.code}
              onChange={handleDiscountInputChange}
              placeholder="e.g. SUMMER20, EARLYBIRD"
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200 uppercase placeholder:normal-case"
              required
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Percent size={16} className="text-[#6b2fa5]" />
              Discount Type
            </label>
            <select
              name="type"
              value={newDiscount.type}
              onChange={handleDiscountInputChange}
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200 appearance-none cursor-pointer"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="flat">Flat Amount (₦)</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <DollarSign size={16} className="text-[#6b2fa5]" />
              Discount Value
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                name="value"
                value={newDiscount.value}
                onChange={handleDiscountInputChange}
                min="0"
                max={newDiscount.type === "percentage" ? 100 : undefined}
                placeholder="Enter value"
                className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
                required
              />
              <div className="px-5 py-3 bg-gradient-to-br from-[#6b2fa5]/10 to-[#8b4fc5]/10 border-2 border-[#6b2fa5]/20 rounded-xl flex items-center font-bold text-[#6b2fa5] min-w-[60px] justify-center">
                {newDiscount.type === "percentage" ? "%" : "₦"}
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Users size={16} className="text-[#6b2fa5]" />
              Maximum Uses
            </label>
            <input
              type="number"
              name="maxUses"
              value={newDiscount.maxUses}
              onChange={handleDiscountInputChange}
              min="1"
              placeholder="How many times can it be used?"
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#6b2fa5] focus:ring-4 focus:ring-[#6b2fa5]/10 transition-all duration-200"
              required
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddDiscount}
          className="w-full px-6 py-4 bg-gradient-to-r from-[#6b2fa5] to-[#8b4fc5] text-white rounded-xl font-bold hover:shadow-lg hover:shadow-[#6b2fa5]/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          ✨ Create Discount Code
        </button>
      </div>

      {/* Discounts Table */}
      <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Value</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Usage</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {discounts.length > 0 ? (
                discounts.map((discount, index) => {
                  const usagePercentage = (discount.usedCount / discount.maxUses) * 100
                  return (
                    <tr
                      key={index}
                      className="hover:bg-slate-50 transition-colors duration-200"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-gradient-to-br from-[#6b2fa5]/10 to-[#8b4fc5]/10 rounded-lg">
                            <Tag size={16} className="text-[#6b2fa5]" />
                          </div>
                          <span className="text-sm font-bold text-slate-900 uppercase">{discount.code}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200">
                          {discount.type === "percentage" ? (
                            <>
                              <Percent size={14} />
                              Percentage
                            </>
                          ) : (
                            <>
                              <DollarSign size={14} />
                              Flat Amount
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-[#6b2fa5]">
                          {discount.type === "percentage" ? `${discount.value}%` : `₦${discount.value.toLocaleString()}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">
                              {discount.usedCount} / {discount.maxUses}
                            </span>
                            <span className="text-slate-500">{Math.round(usagePercentage)}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-[#6b2fa5] to-[#8b4fc5] h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            discount.active
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${discount.active ? "bg-green-500" : "bg-slate-400"}`} />
                          {discount.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleDiscountStatus(index)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 ${
                            discount.active
                              ? "bg-red-100 text-red-700 hover:bg-red-200 border border-red-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200 border border-green-200"
                          }`}
                        >
                          {discount.active ? "🔴 Deactivate" : "🟢 Activate"}
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                        <Tag size={32} className="text-slate-400" />
                      </div>
                      <p className="text-slate-600 font-medium">No discount codes created yet</p>
                      <p className="text-sm text-slate-500">Create your first discount code to get started</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}