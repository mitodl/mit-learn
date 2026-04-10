"use client"

import React from "react"
import { useSearchParams } from "next/navigation"

type ConsumedSearchParamsResult<T> = {
  value: T | undefined
  keysToRemove: readonly string[]
}

type SearchParamsParser<T> = (
  searchParams: URLSearchParams,
) => ConsumedSearchParamsResult<T> | null

/**
 * Parses search params from the URL on first render, stores the parsed value in
 * state, and removes only the params that the parser says belong to the
 * one-time payload.
 *
 * Only runs once — subsequent URL changes are ignored. This is useful for
 * one-time "redirect with data" patterns where query params carry a signal
 * (e.g., enrollment success) that should be shown once and then cleared so
 * it doesn't reappear on refresh.
 */
const useConsumeSearchParamsOnce = <T>(
  parse: SearchParamsParser<T>,
): T | undefined => {
  const searchParams = useSearchParams()
  const [consumed, setConsumed] = React.useState<T | undefined>(undefined)
  const processed = React.useRef(false)

  React.useEffect(() => {
    if (processed.current) return
    processed.current = true

    const parsed = parse(new URLSearchParams(searchParams.toString()))
    if (!parsed) return

    setConsumed(parsed.value)

    if (parsed.keysToRemove.length === 0) {
      return
    }

    const newParams = new URLSearchParams(searchParams.toString())
    for (const name of parsed.keysToRemove) {
      newParams.delete(name)
    }
    const hash = window.location.hash
    const newUrl = newParams.toString()
      ? `${window.location.pathname}?${newParams.toString()}${hash}`
      : `${window.location.pathname}${hash}`

    window.history.replaceState(null, "", newUrl)
  }, [parse, searchParams])

  return consumed
}

export { useConsumeSearchParamsOnce }
export type { ConsumedSearchParamsResult, SearchParamsParser }
