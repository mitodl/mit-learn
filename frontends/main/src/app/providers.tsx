"use client"

import React from "react"
import { getQueryClient } from "./getQueryClient"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider, NextJsAppRouterCacheProvider } from "ol-components"
import { Provider as NiceModalProvider } from "@ebay/nice-modal-react"
import ConfiguredPostHogProvider from "@/components/ConfiguredPostHogProvider/ConfiguredPostHogProvider"
// import { useQueryCacheWarning } from "api/ssr/useQueryCacheWarning"
import { useMissingPrefetchWarning } from "api/ssr/useMissingPrefetchWarning"

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  // useQueryCacheWarning(queryClient)
  useMissingPrefetchWarning(queryClient)

  return (
    <ConfiguredPostHogProvider>
      <QueryClientProvider client={queryClient}>
        <NextJsAppRouterCacheProvider>
          <ThemeProvider>
            <NiceModalProvider>{children}</NiceModalProvider>
          </ThemeProvider>
        </NextJsAppRouterCacheProvider>
      </QueryClientProvider>
    </ConfiguredPostHogProvider>
  )
}
