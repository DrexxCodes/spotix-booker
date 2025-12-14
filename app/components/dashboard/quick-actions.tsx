"use client"

import { Ticket, User, Plus, BarChart3 } from "lucide-react"
import Link from "next/link"

const actions = [
  {
    icon: Ticket,
    label: "Verify Ticket",
    href: "/verify-ticket",
    gradient: "from-[#6b2fa5] via-[#7d3db5] to-[#8b4fc5]",
  },
  {
    icon: User,
    label: "View Profile",
    href: "/profile",
    gradient: "from-[#7d3db5] via-[#8b4fc5] to-[#9a5fd5]",
  },
  {
    icon: Plus,
    label: "Create Event",
    href: "/create-event",
    gradient: "from-[#8b4fc5] via-[#9a5fd5] to-[#a96fe5]",
  },
  {
    icon: BarChart3,
    label: "All Events",
    href: "/events",
    gradient: "from-[#9a5fd5] via-[#a96fe5] to-[#b87ff5]",
  },
]

export function QuickActions() {
  return (
    <div className="mb-8">
      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-[#6b2fa5] to-[#8b4fc5] bg-clip-text text-transparent">
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action, index) => {
          const Icon = action.icon
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group relative overflow-hidden rounded-2xl p-6 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Animated gradient background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${action.gradient} transition-all duration-300`}
              />
              
              {/* Shine effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
              
              {/* Floating orb */}
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              
              <div className="relative flex flex-col items-center text-center gap-3">
                <div className="p-4 rounded-xl bg-white/20 backdrop-blur-sm group-hover:bg-white/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg">
                  <Icon size={32} className="drop-shadow-lg" />
                </div>
                <span className="text-sm font-bold drop-shadow-md group-hover:scale-105 transition-transform duration-300">
                  {action.label}
                </span>
              </div>
              
              {/* Bottom accent line */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}