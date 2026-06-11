"use client"

import { Eye, EyeOff } from "lucide-react"
import { useBalanceVisibility } from "@/hooks/use-balance-visibility"

interface MaskedAmountProps {
  value: string          // pre-formatted string e.g. "₦1,234,567"
  className?: string     // applied to the amount text
  size?: "sm" | "md" | "lg" | "xl"
  showToggle?: boolean   // whether to render the eye icon inline (default true)
  iconClassName?: string
}

const SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
  xl: "text-3xl",
}

const ICON_SIZE = {
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
}

export function MaskedAmount({
  value,
  className = "",
  size = "lg",
  showToggle = true,
  iconClassName = "",
}: MaskedAmountProps) {
  const { visible, toggle } = useBalanceVisibility()

  return (
    <span className="inline-flex items-center gap-1.5 select-none">
      <span className={`${SIZE_CLASSES[size]} font-bold tabular-nums ${className}`}>
        {visible ? value : "₦••••••"}
      </span>
      {showToggle && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle() }}
          aria-label={visible ? "Hide balance" : "Show balance"}
          className={`opacity-50 hover:opacity-100 transition-opacity flex-shrink-0 ${iconClassName}`}
        >
          {visible
            ? <EyeOff size={ICON_SIZE[size]} />
            : <Eye size={ICON_SIZE[size]} />
          }
        </button>
      )}
    </span>
  )
}

/**
 * Convenience: just the eye toggle button (for placing next to a heading/label).
 */
export function BalanceToggleButton({ className = "" }: { className?: string }) {
  const { visible, toggle } = useBalanceVisibility()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={visible ? "Hide balances" : "Show balances"}
      className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all ${className}`}
    >
      {visible ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  )
}
