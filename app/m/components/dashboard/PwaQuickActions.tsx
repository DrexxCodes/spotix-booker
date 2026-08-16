"use client"

import { FileWarning, User, Plus, BarChart3, ChevronRight } from "lucide-react"
import Link from "next/link"

const ACTIONS = [
  {
    icon: Plus,
    label: "Create Event",
    description: "Launch a new event",
    href: "/m/create/event",
    primary: true,
    iconBg: "bg-white/20",
  },
  {
    icon: BarChart3,
    label: "All Events",
    description: "View and manage events",
    href: "/m/events",
    iconBg: "bg-[#6b2fa5]/10",
    iconColor: "text-[#6b2fa5]",
  },
  {
    icon: FileWarning,
    label: "View Reports",
    description: "See if any events were reported",
    href: "/m/report",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    icon: User,
    label: "Profile",
    description: "Account & settings",
    href: "/m/profile",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
]

export function PwaQuickActions() {
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#1e1330]/40">Quick Actions</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`group flex flex-col gap-3 rounded-xl p-4 transition-transform hover:-translate-y-0.5 ${
                action.primary
                  ? "bg-gradient-to-br from-[#6b2fa5] to-[#7c3aed] text-white shadow-lg shadow-purple-900/20"
                  : "pwa-glass"
              }`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${action.iconBg}`}>
                <Icon size={18} className={action.primary ? "text-white" : action.iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold leading-tight ${action.primary ? "text-white" : "text-[#1e1330]"}`}>
                  {action.label}
                </p>
                <p className={`mt-0.5 text-xs ${action.primary ? "text-white/70" : "text-[#1e1330]/40"}`}>
                  {action.description}
                </p>
              </div>
              <ChevronRight
                size={14}
                className={`self-end transition-transform group-hover:translate-x-0.5 ${
                  action.primary ? "text-white/60" : "text-[#1e1330]/25"
                }`}
              />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
