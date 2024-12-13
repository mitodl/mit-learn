"use client"

import React from "react"
import { getQueryClient } from "./getQueryClient"
import { QueryClientProvider } from "@tanstack/react-query"
import { AppProgressBar as ProgressBar } from "next-nprogress-bar"
import type { NProgressOptions } from "next-nprogress-bar"
import { Provider as NiceModalProvider } from "@ebay/nice-modal-react"
import { theme, ThemeProvider } from "ol-components/ThemeProvider/ThemeProvider"
import ConfiguredPostHogProvider from "@/page-components/ConfiguredPostHogProvider/ConfiguredPostHogProvider"
import { usePrefetchWarnings } from "api/ssr/usePrefetchWarnings"
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter"

const PROGRESS_BAR_OPTS: NProgressOptions = { showSpinner: false }

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  usePrefetchWarnings({ queryClient })

  return (
    <>
      <ProgressBar
        height="3px"
        color={theme.custom.colors.brightRed}
        options={PROGRESS_BAR_OPTS}
        shallowRouting
      />
      <QueryClientProvider client={queryClient}>
        <ConfiguredPostHogProvider>
          <AppRouterCacheProvider>
            <ThemeProvider>
              <NiceModalProvider>{children}</NiceModalProvider>
            </ThemeProvider>
          </AppRouterCacheProvider>
        </ConfiguredPostHogProvider>
      </QueryClientProvider>
    </>
  )
}
