"use client"

import { Users } from 'lucide-react'
import { useState } from "react"

interface ProfileData {
  uid?: string
  enabledCollaboration?: boolean
}

interface CollaborationsSectionProps {
  profileData: {
    uid?: string
    enabledCollaboration?: boolean
  }
}

export function CollaborationsSection({ profileData }: CollaborationsSectionProps) {
  const [collaborationEnabled, setCollaborationEnabled] = useState(profileData.enabledCollaboration || false)
  const [isSaving, setIsSaving] = useState(false)

  const handleToggleCollaboration = async () => {
    setIsSaving(true)
    try {
      console.log(" Toggle collaboration called with uid:", profileData.uid)
      
      if (!profileData.uid) {
        console.error(" No UID available")
        alert("User ID not found. Please refresh the page.")
        setIsSaving(false)
        return
      }

      const response = await fetch("/api/profile/collaboration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: profileData.uid,
        }),
      })

      console.log(" Response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log(" API returned:", data)
        setCollaborationEnabled(data.enabledCollaboration)
      } else {
        const errorData = await response.json()
        console.error(" API error response:", errorData)
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error(" Failed to toggle collaboration:", error)
      alert("Failed to toggle collaboration. Check console for details.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mb-8 bg-white rounded-2xl shadow-md p-8 border border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-[#6b2fa5] rounded-lg">
          <Users className="text-white" size={24} />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Collaborations</h2>
        <span className="ml-auto bg-[#6b2fa5] text-white text-xs font-semibold px-3 py-1 rounded-full">New</span>
      </div>

      <p className="text-muted-foreground mb-6">
        Enable collaboration to allow team members to help manage your events. You can enable or disable collaboration
        for specific events in the team management page.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-purple-50 rounded-xl border border-[#6b2fa5]">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-full bg-[#6b2fa5] opacity-20"></div>
          <div>
            <p className="font-semibold text-foreground">Team Collaboration</p>
            <p className="text-sm text-muted-foreground">
              {collaborationEnabled ? "Collaboration is enabled" : "Collaboration is disabled"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleCollaboration}
            disabled={isSaving}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              collaborationEnabled ? "bg-[#6b2fa5]" : "bg-gray-300"
            } ${isSaving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                collaborationEnabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>

          <button className="px-6 py-2 bg-[#6b2fa5] text-white rounded-lg font-medium hover:bg-[#5a2589] transition-colors">
            Manage Team
          </button>
        </div>
      </div>
    </div>
  )
}
