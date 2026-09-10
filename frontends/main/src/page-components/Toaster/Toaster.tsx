"use client"

import React, { useSyncExternalStore } from "react"
import { Snackbar, HEADER_HEIGHT } from "ol-components"
import { Alert } from "@mitodl/smoot-design"
import { subscribeToToast, getToastSnapshot, dismissToast } from "./toastStore"

const getServerSnapshot = () => null

/**
 * App-level host for the global toast. Mounted once (in `providers`).
 * Subscribes to the module-level toast store that `MutationCache.onError`
 * writes to, and renders the current message as a top-center toast.
 *
 * Errors persist until dismissed, since one may carry a "Contact Support"
 * action. Successes are only confirmation, so they time out.
 *
 * The `Alert` is wrapped in a `div` because `Snackbar` clones its child with a
 * ref and the `Alert` does not forward one.
 */
export const Toaster: React.FC = () => {
  const toast = useSyncExternalStore(
    subscribeToToast,
    getToastSnapshot,
    getServerSnapshot,
  )

  const isSuccess = toast?.severity === "success"

  return (
    <Snackbar
      open={Boolean(toast)}
      autoHideDuration={isSuccess ? 6000 : null}
      onClose={(_event, reason) => {
        // Otherwise any stray click clears an error before it's been read.
        if (reason === "clickaway") return
        dismissToast()
      }}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      // MUI's built-in `anchorOriginTopCenter` rule wins on specificity over a
      // plain `top`, so scope the override to clear the fixed site header.
      sx={{ "&.MuiSnackbar-root": { top: `${HEADER_HEIGHT + 16}px` } }}
    >
      <div style={{ width: "min(680px, calc(100vw - 48px))" }}>
        {toast ? (
          <Alert
            severity={toast.severity}
            label={isSuccess ? "Success!" : undefined}
            closable
            onClose={dismissToast}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </div>
    </Snackbar>
  )
}
