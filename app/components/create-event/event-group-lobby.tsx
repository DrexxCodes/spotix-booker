"use client"
import { ArrowLeft } from "lucide-react"

interface EventGroupLobbyProps {
  onCreateCollection: () => void
  onAddToCollection: () => void
  onBack: () => void
}

export function EventGroupLobby({ onCreateCollection, onAddToCollection, onBack }: EventGroupLobbyProps) {
  return (
    <div className="space-y-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:text-[#6b2fa5] transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Event Type Selection
      </button>

      <div className="text-center space-y-2 mb-8">
        <h1 className="text-4xl font-bold text-foreground">Event Group Options</h1>
        <p className="text-lg text-muted-foreground">Choose how you'd like to proceed with your event group</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Create Collection Card */}
        <button
          onClick={onCreateCollection}
          className="group relative overflow-hidden rounded-lg border-2 border-border bg-card p-8 transition-all duration-300 hover:border-[#6b2fa5] hover:shadow-lg hover:shadow-[#6b2fa5]/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#6b2fa5]/0 to-[#6b2fa5]/0 group-hover:from-[#6b2fa5]/5 group-hover:to-[#6b2fa5]/10 transition-all duration-300"></div>

          <div className="relative space-y-4">
            <div className="inline-flex rounded-lg bg-[#6b2fa5]/10 p-3 text-[#6b2fa5] group-hover:bg-[#6b2fa5] group-hover:text-white transition-all duration-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m0 0h6" />
              </svg>
            </div>

            <div className="text-left">
              <h2 className="text-2xl font-bold text-foreground mb-3">Create New Collection</h2>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Start a brand new event collection series</p>

                <ul className="space-y-2 mt-4 pt-4 border-t border-border">
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Create a new event group template</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Set recurrence frequency</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Add individual event instances</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Manage as a series</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 font-semibold text-[#6b2fa5] group-hover:gap-3 transition-all">
              Create <span>→</span>
            </div>
          </div>
        </button>

        {/* Add to Collection Card */}
        <button
          onClick={onAddToCollection}
          className="group relative overflow-hidden rounded-lg border-2 border-border bg-card p-8 transition-all duration-300 hover:border-[#6b2fa5] hover:shadow-lg hover:shadow-[#6b2fa5]/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#6b2fa5]/0 to-[#6b2fa5]/0 group-hover:from-[#6b2fa5]/5 group-hover:to-[#6b2fa5]/10 transition-all duration-300"></div>

          <div className="relative space-y-4">
            <div className="inline-flex rounded-lg bg-[#6b2fa5]/10 p-3 text-[#6b2fa5] group-hover:bg-[#6b2fa5] group-hover:text-white transition-all duration-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            </div>

            <div className="text-left">
              <h2 className="text-2xl font-bold text-foreground mb-3">Add to Existing Collection</h2>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Add an event to one of your existing collections</p>

                <ul className="space-y-2 mt-4 pt-4 border-t border-border">
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Browse your collections</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Add new event to collection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Inherit collection settings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#6b2fa5] font-bold">✓</span>
                    <span>Quick setup</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 font-semibold text-[#6b2fa5] group-hover:gap-3 transition-all">
              Add <span>→</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
