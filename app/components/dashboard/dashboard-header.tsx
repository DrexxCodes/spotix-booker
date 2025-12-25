"use client"

import { useState, useEffect } from "react"
import { getTimeBasedGreeting, getGreetingEmoji, getGreetingAddon } from "@/lib/greeting-utils"
import { RefreshCw, Plus, Sunrise, Sun, Moon, Stars, CloudSun, Sparkles, TrendingUp, Settings } from "lucide-react"
import Link from "next/link"

interface DashboardHeaderProps {
  userName: string
  onRefresh: () => void
  isRefreshing: boolean
}

export function DashboardHeader({ userName, onRefresh, isRefreshing }: DashboardHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  
  const greeting = getTimeBasedGreeting()
  const emoji = getGreetingEmoji()
  const addon = getGreetingAddon()
  const hour = new Date().getHours()

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000) // Update every second for accuracy

    return () => clearInterval(timer)
  }, [])

  // Determine time of day for icon
  const getTimeIcon = () => {
    if (hour >= 5 && hour < 12) {
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-2xl animate-pulse-slow"></div>
          <Sunrise className="relative w-20 h-20 text-amber-400 animate-rise drop-shadow-lg" />
        </div>
      )
    } else if (hour >= 12 && hour < 18) {
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-400/30 rounded-full blur-2xl animate-pulse-slow"></div>
          <Sun className="relative w-20 h-20 text-yellow-400 animate-spin-slow drop-shadow-lg" />
        </div>
      )
    } else {
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-2xl animate-pulse-slow"></div>
          <Moon className="relative w-20 h-20 text-blue-300 animate-glow drop-shadow-lg" />
        </div>
      )
    }
  }

  const getBackgroundGradient = () => {
    if (hour >= 5 && hour < 12) {
      return "from-[#6b2fa5] via-[#8b4fc5] to-[#a668d9]" // Morning purple
    } else if (hour >= 12 && hour < 18) {
      return "from-[#5a26a3] via-[#6b2fa5] to-[#7d3db8]" // Afternoon purple
    } else {
      return "from-[#4a1f8a] via-[#6b2fa5] to-[#5a26a3]" // Evening purple
    }
  }

  return (
    <div className="relative mb-8">
      <div className="grid md:grid-cols-[1fr_auto] gap-6">
        {/* Left: Greeting Card */}
        <div className={`rounded-2xl bg-gradient-to-br ${getBackgroundGradient()} p-8 md:p-10 text-white shadow-2xl overflow-hidden relative group`}>
          {/* Animated mesh gradient background */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white/20 rounded-full blur-3xl animate-float"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float-reverse"></div>
          </div>
          
          {/* Floating particles */}
          {hour >= 18 || hour < 5 ? (
            <>
              <Stars className="absolute top-10 right-20 w-5 h-5 text-white/60 animate-twinkle" />
              <Stars className="absolute top-20 right-32 w-4 h-4 text-white/50 animate-twinkle animation-delay-1000" />
              <Stars className="absolute top-16 right-48 w-6 h-6 text-white/70 animate-twinkle animation-delay-2000" />
              <Sparkles className="absolute bottom-16 left-32 w-5 h-5 text-white/40 animate-twinkle animation-delay-500" />
            </>
          ) : (
            <>
              <Sparkles className="absolute top-12 right-24 w-5 h-5 text-white/50 animate-twinkle" />
              <Sparkles className="absolute bottom-20 right-40 w-4 h-4 text-white/40 animate-twinkle animation-delay-1000" />
            </>
          )}
          
          <div className="relative z-10 flex items-center gap-8">
            <div className="hidden sm:block flex-shrink-0">
              {getTimeIcon()}
            </div>
            
            <div className="flex-1 space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Dashboard Active</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-2xl">
                {greeting},
              </h1>
              <h2 className="text-3xl md:text-4xl font-bold text-white/95 drop-shadow-lg">
                {userName}! 👋
              </h2>
              
              <p className="text-lg md:text-xl text-white/90 font-medium max-w-md">
                {addon}
              </p>
              
              <div className="flex items-center gap-2 text-sm text-white/80 pt-2">
                <TrendingUp size={16} />
                <span>Ready to manage your events</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Actions Panel */}
        <div className="md:w-80 space-y-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 hover:shadow-2xl transition-shadow">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#6b2fa5' }}>
                <Settings size={16} className="text-white" />
              </div>
              So, wanna...
            </h3>
            
            <div className="space-y-3">
              <Link
                href="/create-event"
                className="flex items-center gap-3 w-full px-4 py-3 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all font-semibold group"
                style={{ background: '#6b2fa5' }}
              >
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <span className="flex-1 text-left">Create Event</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>

              <Link
                href="/events"
                className="flex items-center gap-3 w-full px-4 py-3 bg-gradient-to-r from-[#8b4fc5] to-[#9d5fd4] text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all font-semibold group"
              >
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <TrendingUp size={18} />
                </div>
                <span className="flex-1 text-left">View Events</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>

              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-3 w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 hover:shadow-md hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all font-semibold"
              >
                <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                  <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
                </div>
                <span className="flex-1 text-left">{isRefreshing ? "Refreshing..." : "Refresh Data"}</span>
              </button>
            </div>
          </div>
          
          {/* Time Display */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 border border-gray-200 text-center">
            <div className="text-sm text-gray-600 mb-1">Current Time</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: '#6b2fa5' }}>
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes float {
          0%, 100% { 
            transform: translateY(0px) translateX(0px); 
          }
          33% { 
            transform: translateY(-30px) translateX(20px); 
          }
          66% { 
            transform: translateY(-15px) translateX(-15px); 
          }
        }
        
        @keyframes float-reverse {
          0%, 100% { 
            transform: translateY(0px) translateX(0px); 
          }
          33% { 
            transform: translateY(20px) translateX(-20px); 
          }
          66% { 
            transform: translateY(30px) translateX(15px); 
          }
        }
        
        @keyframes rise {
          0%, 100% { 
            transform: translateY(0px) rotate(-5deg); 
            opacity: 0.9;
          }
          50% { 
            transform: translateY(-8px) rotate(5deg); 
            opacity: 1;
          }
        }
        
        @keyframes spin-slow {
          from { 
            transform: rotate(0deg); 
          }
          to { 
            transform: rotate(360deg); 
          }
        }
        
        @keyframes glow {
          0%, 100% { 
            opacity: 0.7;
            filter: drop-shadow(0 0 12px rgba(147, 197, 253, 0.8));
          }
          50% { 
            opacity: 1;
            filter: drop-shadow(0 0 20px rgba(147, 197, 253, 1));
          }
        }
        
        @keyframes twinkle {
          0%, 100% { 
            opacity: 0.2;
            transform: scale(0.8);
          }
          50% { 
            opacity: 1;
            transform: scale(1.4);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% { 
            opacity: 0.4; 
          }
          50% { 
            opacity: 0.8; 
          }
        }
        
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
        
        .animate-float-reverse {
          animation: float-reverse 10s ease-in-out infinite;
        }
        
        .animate-rise {
          animation: rise 4s ease-in-out infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 25s linear infinite;
        }
        
        .animate-glow {
          animation: glow 3s ease-in-out infinite;
        }
        
        .animate-twinkle {
          animation: twinkle 2.5s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        
        .animation-delay-500 {
          animation-delay: 0.5s;
        }
        
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  )
}