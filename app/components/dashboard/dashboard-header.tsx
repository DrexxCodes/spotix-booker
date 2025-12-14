"use client"

import { getTimeBasedGreeting, getGreetingEmoji, getGreetingAddon } from "@/lib/greeting-utils"
import { RefreshCw, Plus } from "lucide-react"
import Link from "next/link"

interface DashboardHeaderProps {
  userName: string
  onRefresh: () => void
  isRefreshing: boolean
}

export function DashboardHeader({ userName, onRefresh, isRefreshing }: DashboardHeaderProps) {
  const greeting = getTimeBasedGreeting()
  const emoji = getGreetingEmoji()
  const addon = getGreetingAddon()

  return (
    <div className="relative mb-8">
      <div className="rounded-2xl bg-gradient-to-br from-[#6b2fa5] via-[#8b4fc5] to-[#5a2890] p-8 md:p-12 text-white shadow-2xl border border-purple-300/20 overflow-hidden relative group">
        {/* Animated background effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_3s_ease-in-out_infinite]"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_50%,rgba(139,79,197,0.3),transparent_50%)] animate-[pulse_4s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_80%,rgba(90,40,144,0.4),transparent_50%)] animate-[pulse_5s_ease-in-out_infinite]"></div>
        
        {/* Floating orbs */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-[float_6s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-10 right-20 w-40 h-40 bg-purple-300/10 rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite] animation-delay-2000"></div>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2 text-white drop-shadow-lg">
              {greeting}, {userName}! {emoji}
            </h1>
            <h4>{addon}</h4>
            <p className="text-white/95 text-lg drop-shadow-md">Welcome back to your Spotix dashboard</p>
          </div>
          <div className="flex gap-3 flex-col sm:flex-row">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#6b2fa5] rounded-lg hover:bg-white/95 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-200 font-semibold shadow-lg"
            >
              <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
            <Link
              href="/create-event"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg hover:from-emerald-600 hover:to-green-700 hover:shadow-xl hover:scale-105 transition-all duration-200 font-semibold shadow-lg"
            >
              <Plus size={18} />
              Create Event
            </Link>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-20px) translateX(10px); }
          66% { transform: translateY(-10px) translateX(-10px); }
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  )
}