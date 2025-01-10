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
import dynamic from "next/dynamic"

const PROGRESS_BAR_OPTS: NProgressOptions = { showSpinner: false }

const ConfiguredPostHogProvider = dynamic(
  () =>
    import(
      "@/page-components/ConfiguredPostHogProvider/ConfiguredPostHogProvider"
    ),
  { ssr: false },
)

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
          <NextJsAppRouterCacheProvider>
            <ThemeProvider>
              <NiceModalProvider>{children}</NiceModalProvider>
            </ThemeProvider>
          </NextJsAppRouterCacheProvider>
        </ConfiguredPostHogProvider>
      </QueryClientProvider>
    </>
  )
}
