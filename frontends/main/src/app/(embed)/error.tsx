"use client"

import React, { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import FallbackErrorPage from "@/app-pages/ErrorPage/FallbackErrorPage"

export const metadata = {
  title: "Error",
}

const Error = ({ error }: { error: Error }) => {
  useEffect(() => {
    console.error("Error encountered in React error boundary:", error)
    Sentry.captureException(error)
  }, [error])

  return <FallbackErrorPage hideHomeButton />
}

export default Error
