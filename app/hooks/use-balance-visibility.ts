"use client"

import { useState, useEffect, useCallback, createContext, useContext } from "react"

const STORAGE_KEY = "spotix_balance_visible"

// ─── Context ──────────────────────────────────────────────────────────────────
interface BalanceVisibilityContext {
  visible: boolean
  toggle: () => void
  mounted: boolean
}

export const BalanceVisibilityCtx = createContext<BalanceVisibilityContext | null>(null)

/**
 * Root hook — owns the state. Use this once at the top of a page/layout tree,
 * then wrap children with <BalanceVisibilityCtx.Provider value={...}>.
 * Components that just need to read/toggle should use useBalanceVisibility().
 */
export function useBalanceVisibilityRoot() {
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) setVisible(stored === "true")
    } catch {}
  }, [])

  const toggle = useCallback(() => {
    setVisible((prev) => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      return next
    })
  }, [])

  return { visible: mounted ? visible : true, toggle, mounted }
}

/**
 * Shared hook for balance visibility toggle.
 * If a BalanceVisibilityCtx is available (provided by a parent), uses that
 * shared state so all consumers re-render together on toggle.
 * Falls back to local state + localStorage for standalone usage.
 */
export function useBalanceVisibility() {
  const ctx = useContext(BalanceVisibilityCtx)
  if (ctx) return ctx

  // Fallback: standalone (shouldn't happen if provider is set up, but safe)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [visible, setVisible] = useState(true)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) setVisible(stored === "true")
    } catch {}
  }, [])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const toggle = useCallback(() => {
    setVisible((prev) => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      return next
    })
  }, [])

  return { visible: mounted ? visible : true, toggle, mounted }
}
