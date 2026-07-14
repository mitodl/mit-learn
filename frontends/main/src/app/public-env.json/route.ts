import { connection } from "next/server"
import { publicEnvObject } from "@/env"

/**
 * Serves all NEXT_PUBLIC_* env vars as JSON. This is the last-resort transport
 * for env() (src/env.ts): a synchronous fetch used whenever no x-public-env
 * <meta> is available — code evaluating while the document is still streaming,
 * or documents that never carry the <meta> at all (root layout AND
 * generateMetadata both failing leaves the error shell with neither copy).
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
