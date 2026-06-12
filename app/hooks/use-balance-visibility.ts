"use client"

import { useState, useEffect, useCallback, createContext, useContext } from "react"

const STORAGE_KEY = "spotix_balance_visible"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlockVisibilityState {
  revenue: boolean
  balance: boolean
  paidOut: boolean
}

interface BalanceVisibilityContext {
  /** Global toggle state (all three blocks) */
  visible: boolean
  /** Per-block overrides */
  blocks: BlockVisibilityState
  /** Toggle all blocks at once */
  toggle: () => void
  /** Toggle a single block independently */
  toggleBlock: (block: keyof BlockVisibilityState) => void
  mounted: boolean
}

export const BalanceVisibilityCtx = createContext<BalanceVisibilityContext | null>(null)

const DEFAULT_BLOCKS: BlockVisibilityState = { revenue: true, balance: true, paidOut: true }

function readStorage(): { global: boolean; blocks: BlockVisibilityState } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { global: true, blocks: DEFAULT_BLOCKS }
    const parsed = JSON.parse(raw)
    // Support old format (plain boolean) gracefully
    if (typeof parsed === "boolean") return { global: parsed, blocks: DEFAULT_BLOCKS }
    return {
      global: parsed.global ?? true,
      blocks: { ...DEFAULT_BLOCKS, ...(parsed.blocks ?? {}) },
    }
  } catch {
    return { global: true, blocks: DEFAULT_BLOCKS }
  }
}

function writeStorage(global: boolean, blocks: BlockVisibilityState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ global, blocks }))
  } catch {}
}

/**
 * Root hook — owns the state. Place once at the top of the dashboard tree,
 * then wrap children with <BalanceVisibilityCtx.Provider value={...}>.
 */
export function useBalanceVisibilityRoot(): BalanceVisibilityContext {
  const [visible, setVisible] = useState(true)
  const [blocks, setBlocks] = useState<BlockVisibilityState>(DEFAULT_BLOCKS)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = readStorage()
    setVisible(stored.global)
    setBlocks(stored.blocks)
    setMounted(true)
  }, [])

  // Toggle all three blocks at once
  const toggle = useCallback(() => {
    setVisible((prev) => {
      const next = !prev
      // When toggling globally, sync all blocks to match
      const nextBlocks: BlockVisibilityState = { revenue: next, balance: next, paidOut: next }
      setBlocks(nextBlocks)
      writeStorage(next, nextBlocks)
      return next
    })
  }, [])

  // Toggle a single block — doesn't change the global state text,
  // but updates visible to reflect whether ALL blocks are now visible
  const toggleBlock = useCallback((block: keyof BlockVisibilityState) => {
    setBlocks((prev) => {
      const next = { ...prev, [block]: !prev[block] }
      const allVisible = Object.values(next).every(Boolean)
      setVisible(allVisible)
      writeStorage(allVisible, next)
      return next
    })
  }, [])

  return {
    visible: mounted ? visible : true,
    blocks: mounted ? blocks : DEFAULT_BLOCKS,
    toggle,
    toggleBlock,
    mounted,
  }
}

/**
 * Shared hook — reads from context if available, falls back to local state.
 * Components that just need to read/toggle use this.
 */
export function useBalanceVisibility(): BalanceVisibilityContext {
  const ctx = useContext(BalanceVisibilityCtx)
  if (ctx) return ctx

  // Fallback standalone (shouldn't happen if provider is set up)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [visible, setVisible] = useState(true)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [blocks, setBlocks] = useState<BlockVisibilityState>(DEFAULT_BLOCKS)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const stored = readStorage()
    setVisible(stored.global)
    setBlocks(stored.blocks)
    setMounted(true)
  }, [])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const toggle = useCallback(() => {
    setVisible((prev) => {
      const next = !prev
      const nextBlocks: BlockVisibilityState = { revenue: next, balance: next, paidOut: next }
      setBlocks(nextBlocks)
      writeStorage(next, nextBlocks)
      return next
    })
  }, [])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const toggleBlock = useCallback((block: keyof BlockVisibilityState) => {
    setBlocks((prev) => {
      const next = { ...prev, [block]: !prev[block] }
      const allVisible = Object.values(next).every(Boolean)
      setVisible(allVisible)
      writeStorage(allVisible, next)
      return next
    })
  }, [])

  return {
    visible: mounted ? visible : true,
    blocks: mounted ? blocks : DEFAULT_BLOCKS,
    toggle,
    toggleBlock,
    mounted,
  }
}
