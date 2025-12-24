"use client"

import { ArrowLeft, FolderPlus, FolderCheck, Check, ArrowRight, Sparkles } from "lucide-react"

interface EventGroupLobbyProps {
  onCreateCollection: () => void
  onAddToCollection: () => void
  onBack: () => void
}

export function EventGroupLobby({ onCreateCollection, onAddToCollection, onBack }: EventGroupLobbyProps) {
  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* Back Button */}
      {/* <div className="animate-in fade-in slide-in-from-left duration-500">
        <button
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-700 hover:text-[#6b2fa5] bg-white hover:bg-[#6b2fa5]/5 border-2 border-slate-200 hover:border-[#6b2fa5]/30 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Event Type Selection
        </button>
      </div> */}

      {/* Header */}
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#6b2fa5] to-purple-600 rounded-3xl shadow-lg shadow-[#6b2fa5]/30 mb-4">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-5xl font-bold bg-gradient-to-r from-[#6b2fa5] via-[#8b3fc5] to-[#6b2fa5] bg-clip-text text-transparent">
          Event Group Options
        </h1>
        
        <p className="text-xl text-slate-600">
          Choose how you'd like to proceed with your event group
        </p>
      </div>

      {/* Options Cards */}
      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Create New Collection Card */}
        <button
          onClick={onCreateCollection}
          className="group relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-8 transition-all duration-300 hover:border-[#6b2fa5] hover:shadow-2xl hover:shadow-[#6b2fa5]/20 hover:-translate-y-2 active:translate-y-0 text-left"
        >
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#6b2fa5]/0 via-purple-500/0 to-[#6b2fa5]/0 group-hover:from-[#6b2fa5]/5 group-hover:via-purple-500/5 group-hover:to-[#6b2fa5]/10 transition-all duration-500"></div>
          
          {/* Gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#6b2fa5] via-purple-400 to-[#6b2fa5] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

          <div className="relative space-y-6">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[#6b2fa5]/10 text-[#6b2fa5] group-hover:bg-[#6b2fa5] group-hover:text-white group-hover:scale-110 transition-all duration-300 shadow-sm group-hover:shadow-md">
              <FolderPlus className="w-8 h-8" />
            </div>

            {/* Content */}
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-slate-900 group-hover:text-[#6b2fa5] transition-colors duration-300">
                Create New Collection
              </h2>

              <p className="text-slate-600 leading-relaxed">
                Start a brand new event collection series
              </p>

              {/* Features List */}
              <ul className="space-y-3 pt-6 border-t-2 border-slate-100">
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600 font-bold" />
                  </div>
                  <span className="text-sm font-medium">Create a new event group template</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600 font-bold" />
                  </div>
                  <span className="text-sm font-medium">Set recurrence frequency</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600 font-bold" />
                  </div>
                  <span className="text-sm font-medium">Add individual event instances</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600 font-bold" />
                  </div>
                  <span className="text-sm font-medium">Manage as a series</span>
                </li>
              </ul>
            </div>

            {/* CTA */}
            <div className="flex items-center justify-between pt-6 border-t-2 border-slate-100">
              <span className="text-sm font-semibold text-slate-500 group-hover:text-[#6b2fa5] transition-colors">
                Start Fresh
              </span>
              <div className="inline-flex items-center gap-2 font-bold text-[#6b2fa5]">
                <span>Create</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-2" />
              </div>
            </div>
          </div>
        </button>

        {/* Add to Existing Collection Card */}
        <button
          onClick={onAddToCollection}
          className="group relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-8 transition-all duration-300 hover:border-[#6b2fa5] hover:shadow-2xl hover:shadow-[#6b2fa5]/20 hover:-translate-y-2 active:translate-y-0 text-left"
        >
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#6b2fa5]/0 via-purple-500/0 to-[#6b2fa5]/0 group-hover:from-[#6b2fa5]/5 group-hover:via-purple-500/5 group-hover:to-[#6b2fa5]/10 transition-all duration-500"></div>
          
          {/* Gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#6b2fa5] via-purple-400 to-[#6b2fa5] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

          <div className="relative space-y-6">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[#6b2fa5]/10 text-[#6b2fa5] group-hover:bg-[#6b2fa5] group-hover:text-white group-hover:scale-110 transition-all duration-300 shadow-sm group-hover:shadow-md">
              <FolderCheck className="w-8 h-8" />
            </div>

            {/* Content */}
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-slate-900 group-hover:text-[#6b2fa5] transition-colors duration-300">
                Add to Existing Collection
              </h2>

              <p className="text-slate-600 leading-relaxed">
                Add an event to one of your existing collections
              </p>

              {/* Features List */}
              <ul className="space-y-3 pt-6 border-t-2 border-slate-100">
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600 font-bold" />
                  </div>
                  <span className="text-sm font-medium">Browse your collections</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600 font-bold" />
                  </div>
                  <span className="text-sm font-medium">Add new event to collection</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600 font-bold" />
                  </div>
                  <span className="text-sm font-medium">Inherit collection settings</span>
                </li>
                <li className="flex items-start gap-3 text-slate-700">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600 font-bold" />
                  </div>
                  <span className="text-sm font-medium">Quick setup</span>
                </li>
              </ul>
            </div>

            {/* CTA */}
            <div className="flex items-center justify-between pt-6 border-t-2 border-slate-100">
              <span className="text-sm font-semibold text-slate-500 group-hover:text-[#6b2fa5] transition-colors">
                Add to Existing
              </span>
              <div className="inline-flex items-center gap-2 font-bold text-[#6b2fa5]">
                <span>Add Event</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-2" />
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Help Text */}
      <div className="text-center max-w-2xl mx-auto p-6 bg-blue-50 border-2 border-blue-100 rounded-xl">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">💡 Tip:</span> Collections help you organize recurring events like monthly workshops or seasonal festivals. Create a new collection to start fresh, or add to an existing one to continue your series.
        </p>
      </div>
    </div>
  )
}