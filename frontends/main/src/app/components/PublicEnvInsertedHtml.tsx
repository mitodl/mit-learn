"use client"

/**
 * Injects an <meta name="x-public-env"> tag carrying all NEXT_PUBLIC_* values
 * (as JSON) into the server-inserted HTML stream. env() (src/env.ts) reads it
 * on first access in the browser.
 *
 * Why server-inserted HTML: when a server error is thrown mid-render, Next.js
 * discards the server-rendered document and responds with its error shell, so
 * anything rendered by the layout arrives only via the RSC payload near the
 * END of the body — too late for scripts that evaluate while the document is
 * still streaming (e.g. instrumentation-client.ts). Server-inserted HTML (the
 * channel used by emotion/MUI style flushing and Next's sentry-trace/baggage
 * metas) is NOT discarded: it is injected into the <head> of the error shell
 * as well as normal documents, arriving with the first bytes of the response.
 *
 * A static <meta> rather than an executable <script>: env() only needs a
 * readable value, and inert markup avoids React's "script tag while rendering"
 * warning when the layout is client-rendered on error pages.
 *
 * The callback only runs during SSR; on the client it is a no-op.
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
