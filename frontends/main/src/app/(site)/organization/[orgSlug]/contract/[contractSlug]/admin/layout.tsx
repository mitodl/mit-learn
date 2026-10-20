import React from "react"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { Permission } from "api/hooks/user"
import { standardizeMetadata } from "@/common/metadata"
import type { Metadata } from "next"

export const metadata: Metadata = standardizeMetadata({
  title: "Seats",
  social: false,
})

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <RestrictedRoute requires={Permission.Authenticated}>
      {children}
    </RestrictedRoute>
  )
}

export default Layout
