"use client"

import { useEffect, useRef, useCallback, useState } from "react"

/**
 * Warns before the user loses in-progress work — the browser's native
 * "leave site?" prompt for a hard reload/tab close, plus an in-app confirm
 * dialog for Link/router.push navigations (which the native beforeunload
 * event can't catch, since those never actually unload the page).
 *
 * Used by create-event, poll create/edit, and election create — see item 8
 * of the UI renovation. Usage:
 *
 *   const { guardNavigation } = useUnsavedChangesWarning(isDirty)
 *   <Link href="/events" onClick={guardNavigation(() => {})}>Cancel</Link>
 *   // or imperatively:
 *   if (guardNavigation()) router.push("/events")
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  const [pendingConfirm, setPendingConfirm] = useState<{ onConfirm: () => void } | null>(null)
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  // Native browser prompt — covers hard reload, tab close, and typed URLs.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [])

  /**
   * Wrap a click handler (e.g. a <Link>'s onClick) or call imperatively
   * before a router.push. Returns `true`/calls `action` immediately if
   * there's nothing to lose; otherwise opens the in-app confirm dialog and
   * defers `action` until the user confirms.
   */
  const guardNavigation = useCallback((action?: () => void) => {
    return (e?: { preventDefault: () => void }) => {
      if (!isDirtyRef.current) {
        action?.()
        return true
      }
      e?.preventDefault()
      setPendingConfirm({ onConfirm: () => action?.() })
      return false
    }
  }, [])

  const confirmLeave = useCallback(() => {
    pendingConfirm?.onConfirm()
    setPendingConfirm(null)
  }, [pendingConfirm])

  const cancelLeave = useCallback(() => setPendingConfirm(null), [])

  return {
    /** Whether the "unsaved changes" confirm dialog should be shown right now. */
    showConfirmDialog: pendingConfirm !== null,
    confirmLeave,
    cancelLeave,
    guardNavigation,
  }
}
