/**
 * A tiny module-level store for the app's error toast.
 *
 * The global `MutationCache.onError` (in `getQueryClient`) fires *outside* React,
 * so it can't call a hook or context setter. It calls `showErrorToast` here; the
 * `<Toaster>` component subscribes via `useSyncExternalStore` and renders it.
 *
 * Deliberately free of React/MUI imports so `getQueryClient` (which also runs
 * during SSR) can import `showErrorToast` without pulling UI into that module.
 */

export type ErrorToast = { message: string }

let current: ErrorToast | null = null
const listeners = new Set<() => void>()

const emit = () => {
  listeners.forEach((listener) => listener())
}

/** Show (or replace) the single error toast. */
export const showErrorToast = (message: string): void => {
  // `current` is a module-level singleton; writing it on the server would leak
  // across concurrent SSR requests. The `MutationCache.onError` that calls this
  // is wired only on the browser client — this guard enforces that invariant.
  if (typeof window === "undefined") return
  current = { message }
  emit()
}

/** Dismiss the current toast, if any. */
export const dismissErrorToast = (): void => {
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

export const getToastSnapshot = (): ErrorToast | null => current
