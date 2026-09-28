import { useCallback, useEffect, useRef, useState } from "react"

/** Announced while a retry is in flight. */
export const RETRYING_STATUS = "Retrying…"

/** Focus has been dropped to nowhere, rather than moved somewhere deliberate. */
const focusWasDropped = () => {
  if (typeof document === "undefined") return false
  const active = document.activeElement
  return active === null || active === document.body
}

/**
 * Owns what happens around a playback retry, which is otherwise imperceptible
 * without sight.
 *
 * **Focus.** The players swap the progress row for the error message and back.
 * Either direction unmounts the control the user was on, sending focus to
 * `<body>` — from there a keyboard user has to tab in from the top of the page,
 * and a screen reader loses its place. Both handoffs are conditional on focus
 * having *actually* been lost: if the user has since moved elsewhere, pulling
 * focus back would be more disruptive than the problem being fixed.
 *
 * **Announcement.** Pressing "Try again" clears the error, so the alert
 * disappears and the button unmounts while the reload is still in flight. That
 * leaves a silent gap, which `isRetrying` fills via a polite live region. Only
 * this gap is announced — the outcome already is: success moves focus to the
 * play button, and failure re-renders the alert.
 *
 * @param error the current playback error, or `null` while healthy
 * @param retry the audio hook's retry action, wrapped as `requestRetry`
 * @param isPlayDisabled whether the play/pause button currently rejects focus
 */
export const usePlaybackRecovery = (
  error: string | null,
  retry: () => void,
  isPlayDisabled: boolean,
) => {
  const playButtonRef = useRef<HTMLButtonElement>(null)
  const retryButtonRef = useRef<HTMLButtonElement>(null)
  // Was the user on one of the controls the error message replaces?
  const hadProgressFocusRef = useRef(false)
  // Did the user ask for this recovery, rather than it arriving on its own?
  const retryPendingRef = useRef(false)
  const [isRetrying, setIsRetrying] = useState(false)

  /** Spread onto the progress row so we know when focus is inside it. */
  const onProgressFocus = useCallback(() => {
    hadProgressFocusRef.current = true
  }, [])

  /** Use in place of `retry` so focus and announcements follow the recovery. */
  const requestRetry = useCallback(() => {
    retryPendingRef.current = true
    setIsRetrying(true)
    retry()
  }, [retry])

  useEffect(() => {
    if (error) {
      // The progress controls just unmounted, or a retry failed and put the
      // message back. Either way, offer the retry button as the landing spot.
      const shouldLand =
        (hadProgressFocusRef.current || retryPendingRef.current) &&
        focusWasDropped()
      hadProgressFocusRef.current = false
      retryPendingRef.current = false
      setIsRetrying(false)
      if (shouldLand) retryButtonRef.current?.focus()
      return
    }

    if (!retryPendingRef.current) return
    // Recovery reloads the source, so the play button is briefly disabled and
    // cannot take focus. Hold the handoff — and the "retrying" status — until
    // the player is actually ready again.
    if (isPlayDisabled) return
    retryPendingRef.current = false
    setIsRetrying(false)
    if (focusWasDropped()) playButtonRef.current?.focus()
  }, [error, isPlayDisabled])

  return {
    playButtonRef,
    retryButtonRef,
    onProgressFocus,
    requestRetry,
    isRetrying,
  }
}
