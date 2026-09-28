import React from "react"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { Permission } from "api/hooks/user"

/**
 * Gates all three receipt routes behind authentication.
 *
 * Receipts are bookmark-prone — saved for expense reports and reopened days
 * later, or opened from a dashboard tab left overnight — so a stale cookie is a
 * routine case rather than an edge one. Without this, the receipt query fails and
 * the learner dead-ends on the generic error page. `RestrictedRoute` instead sends
 * them through Keycloak and back to the receipt they asked for.
 */
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <RestrictedRoute requires={Permission.Authenticated}>
      {children}
    </RestrictedRoute>
  )
}

export default Layout
