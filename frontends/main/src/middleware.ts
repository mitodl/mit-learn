import { type NextRequest, NextResponse } from "next/server"

/**
 * Matches paths that have a file extension (e.g. .js, .css, .woff2).
 * These are static assets that should NOT receive page-level Cache-Control
 * or Surrogate-Key headers — they are served from /_next/static/ with
 * content-addressed filenames and are cached immutably by Fastly.
 */
const STATIC_FILE_EXT = /\.[a-zA-Z0-9]+$/

/**
 * Returns true if the path should receive page-level caching headers
 * (Cache-Control with s-maxage). This mirrors the exclusion logic in the
 * next.config.js `headers()` rules for Surrogate-Key.
 *
 * Sitemaps are explicitly included despite having an .xml extension because
 * they are dynamically generated HTML-adjacent content, not static assets.
 */
function isPageRoute(pathname: string): boolean {
  // JSON healthcheck — exclude from page cache headers
  if (pathname === "/healthcheck") return false
  // Sitemaps are dynamically generated; treat them as page content
  if (pathname.startsWith("/sitemaps/")) return true
  // Everything with a file extension is a static asset
  if (STATIC_FILE_EXT.test(pathname)) return false
  return true
}

/**
 * Next.js middleware: sets the Cache-Control header at request time so that
 * NEXT_CACHE_S_MAXAGE_SECONDS is read from the Kubernetes environment rather
 * than baked into the Docker image at build time.
 *
 * next.config.js `headers()` runs at build time and cannot read env vars
 * that vary across environments (QA vs production). Middleware runs in the
 * Edge Runtime on every request, so process.env is always the live value.
 */
export function middleware(request: NextRequest) {
  if (!isPageRoute(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const sMaxage = process.env.NEXT_CACHE_S_MAXAGE_SECONDS || "1800"
  const cacheControl = `s-maxage=${sMaxage}, stale-if-error=86400, stale-while-revalidate=86400`

  const response = NextResponse.next()
  response.headers.set("Cache-Control", cacheControl)
  return response
}

export const config = {
  matcher: [
    /*
     * Run on all paths except Next.js internals (_next/static, _next/image)
     * which are handled before middleware by the Next.js router. Static file
     * requests that slip through are filtered by isPageRoute() above.
     */
    "/((?!_next/).*)",
  ],
}
