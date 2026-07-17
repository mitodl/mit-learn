import { connection } from "next/server"
import { publicEnvObject } from "@/env"

/**
 * Serves all NEXT_PUBLIC_* env vars as JSON; the last-resort transport for
 * env() (src/env.ts).
 *
 * The .json extension keeps proxy.ts's isPageRoute() from applying page-level
 * CDN caching headers.
 */
export async function GET() {
  // Opt out of static prerendering so process.env is read at request time,
  // not baked in at build time.
  await connection()

  return Response.json(publicEnvObject(), {
    headers: { "Cache-Control": "no-store" },
  })
}
