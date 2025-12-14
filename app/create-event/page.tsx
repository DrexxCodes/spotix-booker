"use client"

import { useState } from "react"
import { ParticlesBackground } from "@/components/particles-background"
import { Nav } from "@/components/nav"
import { EventTypeSelector } from "@/components/create-event/event-type-selector"
import { CreateOneTimeEvent } from "@/components/create-event/create-one-time-event"
import { CreateEventGroup } from "@/components/create-event/create-event-group"
import { EventGroupLobby } from "@/components/create-event/event-group-lobby"
import { CollectionSelector } from "@/components/create-event/collection-selector"

export default function CreateEventPage() {
  const [eventType, setEventType] = useState<"one-time" | "event-group" | null>(null)
  const [eventGroupStep, setEventGroupStep] = useState<"lobby" | "create" | "select" | null>(null)
  const [selectedCollection, setSelectedCollection] = useState<any>(null)

  return (
    <>
      <ParticlesBackground />
      <div className="min-h-screen bg-background">
        <Nav />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!eventType ? (
            <EventTypeSelector onSelect={setEventType} />
          ) : (
            <>
              <button
                onClick={() => {
                  setEventType(null)
                  setEventGroupStep(null)
                  setSelectedCollection(null)
                }}
                className="mb-6 flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:text-[#6b2fa5] transition-colors"
              >
                ← Back to Event Type Selection
              </button>

              {eventType === "one-time" && <CreateOneTimeEvent onSuccess={() => setEventType(null)} />}

              {eventType === "event-group" && !eventGroupStep && (
                <EventGroupLobby
                  onCreateCollection={() => setEventGroupStep("create")}
                  onAddToCollection={() => setEventGroupStep("select")}
                  onBack={() => setEventType(null)}
                />
              )}

              {eventType === "event-group" && eventGroupStep === "create" && (
                <>
                  <button
                    onClick={() => setEventGroupStep(null)}
                    className="mb-6 flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:text-[#6b2fa5] transition-colors"
                  >
                    ← Back to Event Group Options
                  </button>
                  <CreateEventGroup onSuccess={() => setEventType(null)} selectedCollection={null} />
                </>
              )}

              {eventType === "event-group" && eventGroupStep === "select" && !selectedCollection && (
                <CollectionSelector
                  onSelect={(collection) => setSelectedCollection(collection)}
                  onBack={() => setEventGroupStep(null)}
                />
              )}

              {eventType === "event-group" && eventGroupStep === "select" && selectedCollection && (
                <>
                  <button
                    onClick={() => setSelectedCollection(null)}
                    className="mb-6 flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:text-[#6b2fa5] transition-colors"
                  >
                    ← Back to Select Collection
                  </button>
                  <CreateEventGroup onSuccess={() => setEventType(null)} selectedCollection={selectedCollection} />
                </>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
