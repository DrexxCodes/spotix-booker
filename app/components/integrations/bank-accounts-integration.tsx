"use client"

import { useState } from "react"
import { Landmark } from "lucide-react"
import { IntegrationCardShell } from "./integration-card-shell"
import ViewPayoutMethods from "@/components/event-info/helper/ViewPayoutMethods"
import CreatePayoutMethod from "@/components/event-info/helper/CreatePayoutMethod"

interface PayoutMethod {
  id: string
  accountNumber: string
  bankName: string
  bankCode: string
  accountName: string
  primary: boolean
  createdAt: string
}

interface BankAccountsIntegrationProps {
  userId: string
  methods: PayoutMethod[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onMethodCreated: (method: PayoutMethod) => void
}

/**
 * Bank Accounts integration — where payout method creation now lives (moved
 * out of the event page's Payouts tab per item 8 of the UI renovation).
 * Methods are keyed by userId, not eventId, so they were always account-
 * level; every event, poll, and election payout flow reads from the same
 * list. Uses a Lucide icon (not an image logo) per your instruction —
 * Telegram/Zoom/Meet get brand images, this one stays icon-based.
 */
export function BankAccountsIntegration({ userId, methods, loading, error, onRefresh, onMethodCreated }: BankAccountsIntegrationProps) {
  const [addingNew, setAddingNew] = useState(false)

  return (
    <IntegrationCardShell
      icon={<Landmark className="w-5 h-5 text-[#6b2fa5]" />}
      iconBg="bg-[#6b2fa5]/10"
      title="Bank Accounts"
      description="Manage the accounts your event, poll, and election payouts settle into"
      statusLabel={methods.length > 0 ? `${methods.length} linked` : "Not set up"}
      statusTone={methods.length > 0 ? "connected" : "available"}
      instructions={[
        "Tap \"Add account\" and enter the account number + select the bank.",
        "We verify the account name with the bank before saving it.",
        "Mark one account as primary — that's where bulk/default payouts land.",
        "Every event, poll, and election payout flow uses this same list, so you only set it up once.",
      ]}
    >
      {addingNew ? (
        <CreatePayoutMethod
          userId={userId}
          onCreated={(m) => { onMethodCreated(m); setAddingNew(false) }}
          onCancel={() => setAddingNew(false)}
        />
      ) : (
        <ViewPayoutMethods
          methods={methods}
          loading={loading}
          error={error}
          onRefresh={onRefresh}
          onAddNew={() => setAddingNew(true)}
          readOnly={false}
        />
      )}
    </IntegrationCardShell>
  )
}
