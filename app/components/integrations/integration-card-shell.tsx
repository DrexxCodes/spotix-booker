"use client"

import { useState, type ReactNode } from "react"
import Image from "next/image"
import { ChevronDown, Info } from "lucide-react"

interface IntegrationCardShellProps {
  /** Provide either a Lucide icon element (e.g. bank/account integrations)
   *  or `iconSrc` for a brand logo served from /public (Telegram, Zoom,
   *  Google Meet). If both are given, iconSrc wins. */
  icon?: ReactNode
  iconSrc?: string
  iconBg: string
  title: string
  description: string
  statusLabel: string
  statusTone: "connected" | "available" | "soon"
  /** Numbered "how to use" steps shown when the card is expanded. */
  instructions: string[]
  children?: ReactNode
}

const STATUS_STYLES: Record<IntegrationCardShellProps["statusTone"], string> = {
  connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  available: "bg-slate-100 text-slate-500 border-slate-200",
  soon:      "bg-amber-50 text-amber-600 border-amber-200",
}

/**
 * Shared card shell for every entry on the My Integrations page. Handles the
 * click-to-expand "brief instructions" panel so each integration component
 * (telegram-integration.tsx, zoom-integration.tsx, ...) only has to supply
 * its own icon/copy/status and, optionally, its own connect UI as children.
 */
export function IntegrationCardShell({
  icon, iconSrc, iconBg, title, description, statusLabel, statusTone, instructions, children,
}: IntegrationCardShellProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${iconBg}`}>
          {iconSrc
            ? <Image src={iconSrc} alt={`${title} logo`} width={24} height={24} className="object-contain" />
            : icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[statusTone]}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
        <ChevronDown size={18} className={`text-slate-300 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">
              <Info size={13} /> How it works
            </p>
            <ol className="space-y-1.5">
              {instructions.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-600">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#6b2fa5]/10 text-[#6b2fa5] text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          {children}
        </div>
      )}
    </section>
  )
}
