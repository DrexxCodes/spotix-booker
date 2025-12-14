"use client"

import { Video } from "lucide-react"

interface ProfileData {
  uid: string
}

interface VirtualEventsSectionProps {
  profileData: ProfileData
}

export function VirtualEventsSection({ profileData }: VirtualEventsSectionProps) {
  return (
    <div className="mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-md p-8 border border-blue-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-[#6b2fa5] rounded-lg">
          <Video className="text-white" size={24} />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Virtual Events with Zoom</h2>
        <span className="ml-auto bg-[#6b2fa5] text-white text-xs font-semibold px-3 py-1 rounded-full">New</span>
      </div>

      <p className="text-muted-foreground mb-6">
        Connect your Zoom account to create and manage virtual events directly from Spotix. Host webinars, meetings, and
        online events with seamless integration.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-foreground mb-2">✨ Create Virtual Events</h3>
          <p className="text-sm text-muted-foreground">Easily set up webinars and online meetings</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-foreground mb-2">🔗 Automatic Links</h3>
          <p className="text-sm text-muted-foreground">Generate meeting links automatically</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-foreground mb-2">👥 Manage Attendees</h3>
          <p className="text-sm text-muted-foreground">Control registration and access</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-foreground mb-2">📊 Analytics</h3>
          <p className="text-sm text-muted-foreground">Track meetings and attendee data</p>
        </div>
      </div>
    </div>
  )
}
