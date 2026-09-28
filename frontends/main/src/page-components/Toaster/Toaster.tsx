"use client"

import React, { useSyncExternalStore } from "react"
import { Snackbar, HEADER_HEIGHT } from "ol-components"
import { Alert } from "@mitodl/smoot-design"
import {
  subscribeToToast,
  getToastSnapshot,
  dismissErrorToast,
} from "./toastStore"

const getServerSnapshot = () => null

/**
 * App-level host for the global error toast. Mounted once (in `providers`).
 * Subscribes to the module-level toast store that `MutationCache.onError`
 * writes to, and renders the current error as a persistent top-center toast.
 *
 * Persistent (no `autoHideDuration`): an error may carry a "Contact Support"
 * action, so it stays until dismissed via the `Alert`'s own close button.
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

  return (
    <Snackbar
      open={Boolean(toast)}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      // MUI's built-in `anchorOriginTopCenter` rule wins on specificity over a
      // plain `top`, so scope the override to clear the fixed site header.
      sx={{ "&.MuiSnackbar-root": { top: `${HEADER_HEIGHT + 16}px` } }}
    >
      <div style={{ width: "min(680px, calc(100vw - 48px))" }}>
        {toast ? (
          <Alert severity="error" closable onClose={dismissErrorToast}>
            {toast.message}
          </Alert>
        ) : undefined}
      </div>
    </Snackbar>
  )
}
