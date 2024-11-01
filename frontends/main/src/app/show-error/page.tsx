"use client"
/*
 * Error UI for errors originating external to the frontend
 */

import React, { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import * as Sentry from "@sentry/nextjs"
import FallbackErrorPage from "@/app-pages/ErrorPage/FallbackErrorPage"

const Page: React.FC = () => {
  const searchParams = useSearchParams()
  const message = searchParams.get("message") || "Unknown error."
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setError(new Error(message))
  }, [message])

  useEffect(() => {
    if (error) {
      Sentry.captureException(error)
    }
  }, [error])

  return error ? <FallbackErrorPage error={error} /> : null
}

export default Page
