"use client"
/*
 * Fallback error UI for errors within page content.
 *
 * Notes:
 *  - DOES use root layout
 *
 * See for more:
 * https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
 */

import React, { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { usePathname } from "next/navigation"
import FallbackErrorPage from "@/app-pages/ErrorPage/FallbackErrorPage"
import { ForbiddenError } from "@/common/errors"
import ForbiddenPage from "@/app-pages/ErrorPage/ForbiddenPage"

const Error = ({ error }: { error: Error & { digest?: string } }) => {
  const pathname = usePathname()
  useEffect(() => {
    console.error("Error encountered in React error boundary:", error)
    /**
     * Tag with the error digest and route so a CDN-cached "poisoned" error
     * render (which replays the same digest on the same route until the cache
     * entry expires) is easy to segment and correlate with the server-side log
     * that holds the underlying error under the same digest.
     */
    Sentry.captureException(error, {
      tags: { digest: error.digest, route: pathname },
    })
  }, [error, pathname])

  if (error instanceof ForbiddenError) {
    return <ForbiddenPage />
  }

  return <FallbackErrorPage />
}

export default Error
