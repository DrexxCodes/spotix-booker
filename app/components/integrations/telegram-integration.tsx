"use client"

import { IntegrationCardShell } from "./integration-card-shell"
import { TelegramConnect } from "@/components/profile/telegram-connect"

interface TelegramIntegrationProps {
  userId: string
  connected: boolean
}

export function TelegramIntegration({ userId, connected }: TelegramIntegrationProps) {
  return (
    <IntegrationCardShell
      iconSrc="/telegram.webp"
      iconBg="bg-[#229ED9]/10"
      title="Telegram"
      description="Get payout and sales alerts, and manage events on the go"
      statusLabel={connected ? "Connected" : "Not connected"}
      statusTone={connected ? "connected" : "available"}
      instructions={[
        "Tap \"Generate link code\" below to get a one-time code.",
        "Open Telegram and start a chat with the Spotix Booker bot.",
        "Send the code to the bot — your account links automatically.",
        "You'll start receiving alerts and can manage payouts from the chat.",
      ]}
    >
      <TelegramConnect userId={userId} />
    </IntegrationCardShell>
  )
}
