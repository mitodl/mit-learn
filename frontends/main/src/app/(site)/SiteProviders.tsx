"use client"

import React from "react"
import ConfiguredPostHogProvider from "@/page-components/ConfiguredPostHogProvider/ConfiguredPostHogProvider"

export default function SiteProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return <ConfiguredPostHogProvider>{children}</ConfiguredPostHogProvider>
}
