"use client"

import React, { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { usePathname } from "next/navigation"
import FallbackErrorPage from "@/app-pages/ErrorPage/FallbackErrorPage"

const Error = ({ error }: { error: Error & { digest?: string } }) => {
  const pathname = usePathname()
  useEffect(() => {
    console.error("Error encountered in React error boundary:", error)
    Sentry.captureException(error, {
      tags: { digest: error.digest, route: pathname },
    })
  }, [error, pathname])

  return <FallbackErrorPage showHomeButton={false} />
}

export default Error
