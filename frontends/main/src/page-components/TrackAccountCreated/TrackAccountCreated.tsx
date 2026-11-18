import * as React from "react"
import { useUserMe } from "api/hooks/user"
import { analytics } from "@/common/analytics"

const NEW_USER_PARAM = "is_new_user"
const SESSION_KEY = "gtm_account_created_tracked"

/**
 * Send the account-created event when the login view lands a first-time
 * learner here with `is_new_user=1`, on onboarding or, when onboarding is
 * skipped, wherever they were headed. Rendered once, in the root providers.
 */
const TrackAccountCreated: React.FC = () => {
  const { data: user } = useUserMe()
  const isAuthenticated = !!user?.is_authenticated

  React.useEffect(() => {
    if (!isAuthenticated) return
    const url = new URL(window.location.href)
    if (url.searchParams.get(NEW_USER_PARAM) !== "1") return
    // Remove it so a reload or a shared link doesn't count the account again.
    url.searchParams.delete(NEW_USER_PARAM)
    window.history.replaceState(window.history.state, "", url)

    let alreadyTracked = false
    try {
      alreadyTracked = Boolean(sessionStorage.getItem(SESSION_KEY))
      if (!alreadyTracked) sessionStorage.setItem(SESSION_KEY, "1")
    } catch {
      // Storage may be unavailable; track without deduplication.
    }
    if (!alreadyTracked) analytics.accountCreated()
  }, [isAuthenticated])

  return null
}

export { TrackAccountCreated }
