"use client"

import React from "react"
import { getQueryClient } from "./getQueryClient"
import { QueryClientProvider } from "@tanstack/react-query"
import {
  ThemeProvider,
  NextJsAppRouterCacheProvider,
  theme,
} from "ol-components"
import { Provider as NiceModalProvider } from "@ebay/nice-modal-react"
import { usePrefetchWarnings } from "api/ssr/usePrefetchWarnings"
import { AppProgressBar as ProgressBar } from "next-nprogress-bar"
import type { NProgressOptions } from "next-nprogress-bar"
import { ReloadOnUserChange } from "@/page-components/ReloadOnUserChange/ReloadOnUserChange"
import { bootstrapApiClients } from "@/bootstrap/api"

const PROGRESS_BAR_OPTS: NProgressOptions = { showSpinner: false }

// Configure API clients before any child render path can fire React Query hooks.
// Keeping this at module scope ensures bootstrap happens before the first request.
bootstrapApiClients()

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
        <ReloadOnUserChange />
        <NextJsAppRouterCacheProvider>
          <ThemeProvider>
            <NiceModalProvider>{children}</NiceModalProvider>
          </ThemeProvider>
        </NextJsAppRouterCacheProvider>
      </QueryClientProvider>
    </>
  )
}
