"use client"

/*
 * Fallback error UI for errors within root layout.
 * (error.tsx is the fallback error page for UI within page content.)
 *
 * Notes:
 *  - does NOT use root layout (since error occurred there!)
 *  - therefore, must define its own HTML tags and providers
 *    Must define its own HTML tag
 *  - NOT used in development mode
 *
 * https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
 */
import React, { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import FallbackErrorPage from "@/app-pages/ErrorPage/FallbackErrorPage"
import { ThemeProvider, MITLearnGlobalStyles } from "ol-components"

export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    console.error("Error encountered in global error boundary:", error)
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <MITLearnGlobalStyles />
          <FallbackErrorPage />
        </ThemeProvider>
      </body>
    </html>
  )
}
