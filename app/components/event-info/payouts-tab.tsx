"use client"
import { Wallet, ArrowUpRight, AlertCircle, Shield } from "lucide-react"

interface PayoutData {
  id?: string
  date: string
  transactionTime?: string
  amount: number
  status: string
  reference?: string
  actionCode?: string
}

interface PayoutsTabProps {
  payouts: PayoutData[]
  availableBalance: number
  totalPaidOut: number
  selectedPayoutId: string | null
  actionCode: string
  copiedField: string | null
  visibleActionCodes: Record<string, boolean>
  setSelectedPayoutId: (id: string | null) => void
  setActionCode: (code: string) => void
  handleConfirmPayout: (payoutId: string) => void
  copyToClipboard: (text: string, field: string) => void
  toggleActionCodeVisibility: (payoutId: string) => void
  formatTransactionTime: (timestamp: any) => string
}

export default function PayoutsTab({
  payouts,
  availableBalance,
  totalPaidOut,
  copiedField,
  copyToClipboard,
}: PayoutsTabProps) {
  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          When an admin initiates a payout, you'll see an action code below. Share this code with the admin to complete
          the payout process.
        </p>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Available Balance Card */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 flex gap-4">
          <div className="p-3 bg-purple-100 rounded-lg h-fit">
            <Wallet size={24} className="text-purple-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-1">Available Balance</h4>
            <p className="text-2xl font-bold text-slate-900">₦{availableBalance.toLocaleString()}</p>
            <p className="text-xs text-slate-600 mt-1">Ready to withdraw</p>
          </div>
        </div>

        {/* Total Paid Out Card */}
        <div className="bg-white rounded-lg p-6 border border-slate-200 flex gap-4">
          <div className="p-3 bg-green-100 rounded-lg h-fit">
            <ArrowUpRight size={24} className="text-green-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-1">Total Paid Out</h4>
            <p className="text-2xl font-bold text-slate-900">₦{totalPaidOut.toLocaleString()}</p>
            <p className="text-xs text-slate-600 mt-1">Successfully processed</p>
          </div>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Time</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Reference</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Amount</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
            </tr>
          </thead>
          <tbody>
            {payouts.length > 0 ? (
              payouts.map((payout) => (
                <tr key={payout.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-900">{payout.date}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{payout.transactionTime || "N/A"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{payout.reference || "N/A"}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">₦{payout.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        payout.status === "Completed"
                          ? "bg-green-100 text-green-700"
                          : payout.status === "Pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {payout.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-600">
                  No payouts yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Security Information */}
      <div className="bg-white rounded-lg p-6 border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-slate-900" />
          <h4 className="text-lg font-semibold text-slate-900">Payout Security Information</h4>
        </div>
        <div className="space-y-3 text-sm text-slate-700">
          <p>For your security, we use action codes to verify payout requests. When an admin initiates a payout:</p>
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>You'll see an action code in the table above</li>
            <li>Share this code with the admin who initiated the payout</li>
            <li>The admin will enter this code to verify and process your payout</li>
            <li>Once verified, your payout will be processed</li>
          </ol>
          <p className="text-yellow-700 bg-yellow-50 p-3 rounded-lg font-semibold">
            Important: Never share your action codes with anyone except the admin who initiated your payout.
          </p>
        </div>
      </div>
    </div>
  )
}
