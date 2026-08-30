"use client"

import { IntegrationCardShell } from "./integration-card-shell"

/**
 * Zoom integration entry — moved here from the old profile page's
 * "Virtual Events with Zoom" promo block (see item 4 of the UI renovation).
 * Presentational for now; wire up the real OAuth connect button here once
 * the backend endpoint exists.
 */
export function ZoomIntegration() {
  return (
    <IntegrationCardShell
      iconSrc="/zoom.png"
      iconBg="bg-[#2D8CFF]/10"
      title="Zoom"
      description="Host virtual events and generate meeting links automatically"
      statusLabel="Coming soon"
      statusTone="soon"
      instructions={[
        "Connect your Zoom account from this card.",
        "When creating a virtual event, choose Zoom as the venue type.",
        "Spotix generates and attaches a unique meeting link per event automatically.",
        "Attendee registration and access are managed from your event's dashboard.",
      ]}
    >
      <button
        disabled
        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm font-semibold cursor-not-allowed"
      >
        Connect Zoom — coming soon
      </button>
    </IntegrationCardShell>
  )
}
