"use client"

import React from "react"
import { getQueryClient } from "./getQueryClient"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "ol-components/ThemeProvider/ThemeProvider"
import { Provider as NiceModalProvider } from "@ebay/nice-modal-react"
import ConfiguredPostHogProvider from "@/page-components/ConfiguredPostHogProvider/ConfiguredPostHogProvider"
import { usePrefetchWarnings } from "api/ssr/usePrefetchWarnings"
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter"

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  usePrefetchWarnings({ queryClient })

  return (
    <QueryClientProvider client={queryClient}>
      <ConfiguredPostHogProvider>
        <AppRouterCacheProvider>
          <ThemeProvider>
            <NiceModalProvider>{children}</NiceModalProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </ConfiguredPostHogProvider>
    </QueryClientProvider>
  )
}
