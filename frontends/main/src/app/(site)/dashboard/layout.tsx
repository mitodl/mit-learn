import React from "react"
import DashboardLayout from "@/app-pages/DashboardPage/DashboardLayout"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import { Permission } from "api/hooks/user"
import { standardizeMetadata } from "@/common/metadata"
import type { Metadata } from "next"

export const metadata: Metadata = standardizeMetadata({
  title: "Your MIT Learning Journey",
  social: false,
})

const Layout: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <RestrictedRoute requires={Permission.Authenticated}>
      <DashboardLayout>{children}</DashboardLayout>
    </RestrictedRoute>
  )
}

export default Layout
