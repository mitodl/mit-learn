/**
 * A tiny module-level store for the app's global toast.
 *
 * The global `MutationCache.onError` (in `getQueryClient`) fires *outside* React,
 * so it can't call a hook or context setter. It calls `showErrorToast` here; the
 * `<Toaster>` component subscribes via `useSyncExternalStore` and renders it.
 *
 * Success toasts share the store so an action can confirm itself in place,
 * without navigating to a page that has its own alert slot.
 *
 * Deliberately free of React/MUI imports so `getQueryClient` (which also runs
 * during SSR) can import `showErrorToast` without pulling UI into that module.
 */

export type ToastSeverity = "error" | "success"

export type Toast = { message: string; severity: ToastSeverity }

let current: Toast | null = null
const listeners = new Set<() => void>()

const emit = () => {
  listeners.forEach((listener) => listener())
}

const show = (message: string, severity: ToastSeverity): void => {
  // `current` is a module-level singleton; writing it on the server would leak
  // across concurrent SSR requests. Callers are browser-only; this enforces it.
  if (typeof window === "undefined") return
  current = { message, severity }
  emit()
}

/** Show (or replace) the single toast, as an error. */
export const showErrorToast = (message: string): void => show(message, "error")

/** Show (or replace) the single toast, as a success. */
export const showSuccessToast = (message: string): void =>
  show(message, "success")

/** Dismiss the current toast, if any. */
export const dismissToast = (): void => {
  if (!current) return
  current = null
  emit()
}

export const subscribeToToast = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getToastSnapshot = (): Toast | null => current
