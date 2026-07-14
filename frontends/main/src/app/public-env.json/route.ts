import { connection } from "next/server"
import { publicEnvObject } from "@/env"

/**
 * Serves all NEXT_PUBLIC_* env vars as JSON. This is the synchronous fallback
 * transport for env() (src/env.ts) on error/not-found pages, where the inline
 * PublicEnvScript is discarded and the x-public-env <meta> streams too late in
 * the body for early module evaluation to read it.
 *
 * The .json extension keeps proxy.ts's isPageRoute() from applying page-level
 * CDN caching headers; no-store ensures each deploy's values are always fresh.
 */
export async function GET() {
  // Opt out of static prerendering so process.env is read at request time,
  // not baked in at build time.
  await connection()

  return Response.json(publicEnvObject(), {
    headers: { "Cache-Control": "no-store" },
  })
}
