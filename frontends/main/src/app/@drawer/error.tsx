"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

export const metadata = {
  title: "Error",
}

const Error = ({ error }: { error: Error }) => {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return null
}

export default Error
