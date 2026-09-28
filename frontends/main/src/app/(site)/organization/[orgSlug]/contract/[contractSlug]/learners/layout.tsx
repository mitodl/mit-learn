import React from "react"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { Permission } from "api/hooks/user"
import { standardizeMetadata } from "@/common/metadata"
import type { Metadata } from "next"

export const metadata: Metadata = standardizeMetadata({
  title: "Learner Directory",
  social: false,
})

/**
 * RestrictedRoute and nothing else, so this route stays outside the dashboard
 * shell — see CONTRACT_LEARNERS_VIEW. Manager authorization is the page's own
 * job, as it is for the sibling admin route.
 */
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <RestrictedRoute requires={Permission.Authenticated}>
      {children}
    </RestrictedRoute>
  )
}

export default Layout
