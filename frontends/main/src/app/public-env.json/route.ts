import { connection } from "next/server"
import { publicEnvObject } from "@/env"

/**
 * Serves all NEXT_PUBLIC_* env vars as JSON. This is the last-resort transport
 * for env() (src/env.ts): a synchronous fetch for code that evaluates while
 * the document is still streaming and no x-public-env <meta> has been parsed
 * yet (in practice only global-error responses, where the head copy of the
 * <meta> is missing because Providers never rendered).
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
