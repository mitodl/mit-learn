/**
 * Next.js Middleware — Surrogate-Key headers for Fastly cache purging
 *
 * Sets `Surrogate-Key` response headers on MITxOnline course and program
 * product pages so that Fastly can invalidate them by tag when MITxOnline
 * data changes (e.g. Wagtail publish, Django admin save).
 *
 * Key format (matches what MITxOnline purges):
 *   mitxonline:course:<readable_id>   — /courses/<readable_id>
 *                                     — /courses/p/<readable_id>
 *   mitxonline:program:<readable_id>  — /programs/<readable_id>
 *
 * NOTE: This must be done in middleware rather than in page.tsx because
 * Next.js commits response headers before any page/layout code runs (to
 * begin streaming). By the time page.tsx executes, headers have already
 * been sent.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Matches /courses/<readable_id> — readable_ids contain colons and + but no slashes.
const COURSE_PATTERN = /^\/courses\/([^/?]+)$/
// Matches /courses/p/<readable_id>
const COURSE_P_PATTERN = /^\/courses\/p\/([^/?]+)$/
// Matches /programs/<readable_id>
const PROGRAM_PATTERN = /^\/programs\/([^/?]+)$/

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let surrogateKey: string | null = null

  const courseMatch =
    COURSE_P_PATTERN.exec(pathname) ?? COURSE_PATTERN.exec(pathname)
  if (courseMatch) {
    const readableId = decodeURIComponent(courseMatch[1])
    surrogateKey = `mitxonline:course:${readableId}`
  }

  const programMatch = PROGRAM_PATTERN.exec(pathname)
  if (programMatch) {
    const readableId = decodeURIComponent(programMatch[1])
    surrogateKey = `mitxonline:program:${readableId}`
  }

  if (!surrogateKey) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  response.headers.set("Surrogate-Key", surrogateKey)
  return response
}

export const config = {
  /*
   * Match only the product page routes. Excludes static files, _next internals,
   * and API routes so middleware overhead is minimal.
   */
  matcher: ["/courses/:readable_id*", "/programs/:readable_id*"],
}
