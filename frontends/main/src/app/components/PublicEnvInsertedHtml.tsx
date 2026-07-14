"use client"

/**
 * Emits an <meta name="x-public-env"> tag carrying all NEXT_PUBLIC_* values
 * (as JSON) into the server-inserted HTML stream, for env() (src/env.ts) to
 * read in the browser.
 *
 * Server-inserted HTML reaches the <head> of error responses too, unlike
 * rendered markup, which Next discards when a server error is thrown
 * mid-render. A <meta> rather than a <script>: env() only needs a readable
 * value, and inert markup avoids React's "script tag while rendering" warning
 * on client-rendered error pages.
 */
import React, { useRef } from "react"
import { useServerInsertedHTML } from "next/navigation"
import { publicEnvObject } from "@/env"

export function PublicEnvInsertedHtml() {
  // useServerInsertedHTML fires on every stream flush; emit only once.
  const inserted = useRef(false)
  useServerInsertedHTML(() => {
    if (inserted.current) return null
    inserted.current = true
    // Raw JSON is fine: React HTML-escapes the attribute and getAttribute()
    // returns it decoded, so JSON.parse round-trips.
    return (
      <meta name="x-public-env" content={JSON.stringify(publicEnvObject())} />
    )
  })
  return null
}
