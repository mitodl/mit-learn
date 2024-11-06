"use client"

import React, { useEffect } from "react"
import { getQueryClient } from "./getQueryClient"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider, NextJsAppRouterCacheProvider } from "ol-components"
import { Provider as NiceModalProvider } from "@ebay/nice-modal-react"
import ConfiguredPostHogProvider from "@/components/ConfiguredPostHogProvider/ConfiguredPostHogProvider"

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  useEffect(() => {
    const onLoad = () => {
      queryClient.setQueryData(["initialRenderComplete"], true)
      window.removeEventListener("load", onLoad)
    }
    if (document.readyState === "complete") {
      onLoad()
    } else {
      window.addEventListener("load", onLoad)
    }
  })

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
