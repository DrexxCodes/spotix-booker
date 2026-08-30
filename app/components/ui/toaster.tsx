"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react"
import { subscribeToast, subscribeDismiss, toast, type ToastMessage, type ToastVariant } from "@/lib/toast"

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof CheckCircle2; iconClass: string; barClass: string }> = {
  success: { icon: CheckCircle2, iconClass: "text-emerald-500", barClass: "bg-emerald-500" },
  error:   { icon: XCircle,      iconClass: "text-red-500",     barClass: "bg-red-500" },
  info:    { icon: Info,         iconClass: "text-[#6b2fa5]",   barClass: "bg-[#6b2fa5]" },
  warning: { icon: AlertTriangle, iconClass: "text-amber-500",  barClass: "bg-amber-500" },
}

/**
 * Global toast renderer — mount once in app/layout.tsx. See app/lib/toast.ts
 * for the imperative `toast.success/error/info/warning(...)` API used
 * throughout the app to fire these.
 */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const unsubAdd = subscribeToast((message) => {
      setToasts((prev) => [...prev, message])
      const timer = setTimeout(() => toast.dismiss(message.id), message.duration)
      timers.current.set(message.id, timer)
    })
    const unsubDismiss = subscribeDismiss((id) => {
      const timer = timers.current.get(id)
      if (timer) { clearTimeout(timer); timers.current.delete(id) }
      setToasts((prev) => prev.filter((t) => t.id !== id))
    })
    return () => { unsubAdd(); unsubDismiss() }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const { icon: Icon, iconClass, barClass } = VARIANT_STYLES[t.variant]
        return (
          <div
            key={t.id}
            className="relative overflow-hidden bg-white rounded-xl border border-slate-200 shadow-lg shadow-black/[0.08] p-3.5 pl-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${barClass}`} />
            <Icon size={18} className={`flex-shrink-0 mt-0.5 ${iconClass}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-tight">{t.title}</p>
              {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="flex-shrink-0 text-slate-300 hover:text-slate-600 transition-colors"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
