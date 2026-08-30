/**
 * Lightweight global toast system (see app/components/ui/toaster.tsx for the
 * renderer, mounted once in app/layout.tsx). Call `toast.success(...)` /
 * `toast.error(...)` etc from anywhere — client components, event handlers,
 * even outside React — no provider/context wiring needed at the call site.
 *
 * Mirrors the module-level listener-array pattern already used for auth
 * events in hooks/useAuth.ts, so it's consistent with the rest of the app.
 */

export type ToastVariant = "success" | "error" | "info" | "warning"

export interface ToastMessage {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  duration: number
}

type ToastListener = (toast: ToastMessage) => void
type DismissListener = (id: string) => void

let toastListeners: ToastListener[] = []
let dismissListeners: DismissListener[] = []

function emit(variant: ToastVariant, title: string, opts?: { description?: string; duration?: number }) {
  const message: ToastMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    variant,
    title,
    description: opts?.description,
    duration: opts?.duration ?? 4000,
  }
  toastListeners.forEach((listener) => listener(message))
  return message.id
}

export const toast = {
  success: (title: string, opts?: { description?: string; duration?: number }) => emit("success", title, opts),
  error:   (title: string, opts?: { description?: string; duration?: number }) => emit("error", title, opts),
  info:    (title: string, opts?: { description?: string; duration?: number }) => emit("info", title, opts),
  warning: (title: string, opts?: { description?: string; duration?: number }) => emit("warning", title, opts),
  dismiss: (id: string) => dismissListeners.forEach((listener) => listener(id)),
}

/** Internal — subscribed by <Toaster /> only. */
export function subscribeToast(listener: ToastListener): () => void {
  toastListeners.push(listener)
  return () => { toastListeners = toastListeners.filter((l) => l !== listener) }
}

/** Internal — subscribed by <Toaster /> only. */
export function subscribeDismiss(listener: DismissListener): () => void {
  dismissListeners.push(listener)
  return () => { dismissListeners = dismissListeners.filter((l) => l !== listener) }
}
