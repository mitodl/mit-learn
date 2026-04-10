"use client"

import React from "react"
import { useSearchParams } from "next/navigation"

/**
 * Reads a set of search params from the URL on first render, stores them in
 * state, and removes them from the URL. Returns `null` if none of the named
 * params were present; otherwise returns a record of their values.
 *
 * Only runs once — subsequent URL changes are ignored. This is useful for
 * one-time "redirect with data" patterns where query params carry a signal
 * (e.g., enrollment success) that should be shown once and then cleared so
 * it doesn't reappear on refresh.
 */
const useConsumeInitialSearchParams = <T extends string>(
  paramNames: readonly T[],
): Readonly<Record<T, string | null>> | null => {
  const searchParams = useSearchParams()
  const [consumed, setConsumed] = React.useState<Record<
    T,
    string | null
  > | null>(null)
  const processed = React.useRef(false)

  React.useEffect(() => {
    if (processed.current) return
    processed.current = true

    const hasAny = paramNames.some((name) => searchParams.has(name))
    if (!hasAny) return

    const values = {} as Record<T, string | null>
    for (const name of paramNames) {
      values[name] = searchParams.get(name)
    }
    setConsumed(values)

    const newParams = new URLSearchParams(searchParams.toString())
    for (const name of paramNames) {
      newParams.delete(name)
    }
    const hash = window.location.hash
    const newUrl = newParams.toString()
      ? `${window.location.pathname}?${newParams.toString()}${hash}`
      : `${window.location.pathname}${hash}`

    window.history.replaceState(null, "", newUrl)
  }, [paramNames, searchParams])

  return consumed
}

export { useConsumeInitialSearchParams }
