/**
 * Server Component that injects all NEXT_PUBLIC_* environment variables into
 * the page HTML as a synchronous inline <script> before any JS bundle loads.
 *
 * This enables the `env()` helper (src/env.ts) to read per-environment values
 * at runtime in the browser, decoupling them from webpack's build-time
 * DefinePlugin substitution.
 *
 * Placement: render inside <head> in the root app/layout.tsx.
 *
 * Execution order guarantee: a plain <script> (not next/script) in <head>
 * runs synchronously during HTML parsing — before any deferred or async JS
 * module loads. `window.__ENV` is therefore available when
 * instrumentation-client.ts (Sentry) and all React component modules evaluate.
 *
 * Security: JSON output is sanitized to prevent </script> injection. The app
 * currently has no CSP; if one is added, this script will need a nonce.
 */
import React from "react"
import { connection } from "next/server"
import { publicEnvObject } from "@/env"

export async function PublicEnvScript() {
  // `connection()` opts this route out of static prerendering so that
  // process.env is read fresh on every request (not baked at build time).
  await connection()

  // Escape `<` to prevent a value like `</script><script>...` from breaking
  // out of the script tag.
  const json = JSON.stringify(publicEnvObject()).replace(/</g, "\\u003c")

  return (
    <script dangerouslySetInnerHTML={{ __html: `window.__ENV=${json};` }} />
  )
}
