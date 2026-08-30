"use client"

import { IntegrationCardShell } from "./integration-card-shell"

/**
 * Google Meet integration entry — companion to Zoom for virtual events
 * (see item 4 of the UI renovation). Presentational for now; wire up the
 * real Google OAuth connect flow once the backend endpoint exists.
 */
export function GoogleMeetIntegration() {
  return (
    <IntegrationCardShell
      iconSrc="/meet.webp"
      iconBg="bg-[#00897B]/10"
      title="Google Meet"
      description="Run virtual events straight from your Google account"
      statusLabel="Coming soon"
      statusTone="soon"
      instructions={[
        "Connect your Google account from this card.",
        "When creating a virtual event, choose Google Meet as the venue type.",
        "Spotix generates and attaches a unique Meet link per event automatically.",
        "Attendee registration and access are managed from your event's dashboard.",
      ]}
    >
      <button
        disabled
        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm font-semibold cursor-not-allowed"
      >
        Connect Google Meet — coming soon
      </button>
    </IntegrationCardShell>
  )
}
