import { useEffect } from "react"
import { useUserMe } from "api/hooks/user"
import { env } from "@/env"

declare global {
  interface Window {
    _hsq?: unknown[][]
  }
}

/**
 * Calls HubSpot's identify API when the user is authenticated so that
 * HubSpot can merge the anonymous pixel-tracked visit record (which carries
 * the acquisition source/channel) with the API-created contact record.
 *
 * Without this, contacts created via the Django backend default to
 * "Offline Sources" in HubSpot because the pixel's anonymous session is
 * never linked to the user's email.
 */
const HubspotIdentifier = () => {
  const { data: user } = useUserMe()

  useEffect(() => {
    if (!env("NEXT_PUBLIC_HUBSPOT_PORTAL_ID")) return
    if (!user?.is_authenticated || !user.email) return

    window._hsq = window._hsq || []
    window._hsq.push(["identify", { email: user.email }])
  }, [user])

  return null
}

export default HubspotIdentifier
export { HubspotIdentifier }
