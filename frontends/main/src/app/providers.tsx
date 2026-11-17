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
import { ComplianceGateProvider } from "@/common/mitxonline/useComplianceGate"
import { usePrefetchWarnings } from "api/ssr/usePrefetchWarnings"
import { AppProgressBar as ProgressBar } from "next-nprogress-bar"
import type { NProgressOptions } from "next-nprogress-bar"
import { ReloadOnUserChange } from "@/page-components/ReloadOnUserChange/ReloadOnUserChange"
import { TrackAccountCreated } from "@/page-components/TrackAccountCreated/TrackAccountCreated"
import { PublicEnvInsertedHtml } from "./components/PublicEnvInsertedHtml"
import { Toaster } from "@/page-components/Toaster/Toaster"
import type { ServerFlags } from "@/common/feature_flags"
import { ServerFlagsContext } from "@/common/useFeatureFlag"

const PROGRESS_BAR_OPTS: NProgressOptions = { showSpinner: false }

export default function Providers({
  children,
  serverFlags,
}: {
  children: React.ReactNode
  serverFlags: ServerFlags
}) {
  const queryClient = getQueryClient()

  usePrefetchWarnings({ queryClient })

  return (
    <ServerFlagsContext.Provider value={serverFlags}>
      <PublicEnvInsertedHtml />
      <ProgressBar
        height="3px"
        color={theme.custom.colors.brightRed}
        options={PROGRESS_BAR_OPTS}
        shallowRouting
      />
      <QueryClientProvider client={queryClient}>
        <ReloadOnUserChange />
        <TrackAccountCreated />
        <NextJsAppRouterCacheProvider>
          <ThemeProvider>
            <NiceModalProvider>
              <ComplianceGateProvider>{children}</ComplianceGateProvider>
            </NiceModalProvider>
            <Toaster />
          </ThemeProvider>
        </NextJsAppRouterCacheProvider>
      </QueryClientProvider>
    </ServerFlagsContext.Provider>
  )
}
