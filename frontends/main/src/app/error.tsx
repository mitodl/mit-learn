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

import React from "react"
import FallbackErrorPage from "@/app-pages/ErrorPage/FallbackErrorPage"
import { ForbiddenError } from "@/common/errors"
import ForbiddenPage from "@/app-pages/ErrorPage/ForbiddenPage"

export const metadata = {
  title: "Error",
}

const Error = ({ error }: { error: Error }) => {
  if (error instanceof ForbiddenError) {
    return <ForbiddenPage />
  }

  return <FallbackErrorPage error={error} />
}

export default Error
