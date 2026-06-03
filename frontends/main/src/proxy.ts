import { type NextRequest, NextResponse } from "next/server"

/**
 * Matches paths ending in a known static-asset extension (e.g. .js, .css,
 * .woff2). These are served as immutable files (from /_next/static/, /images/,
 * the /static rewrite, or public/) and must NOT receive page-level
 * Cache-Control or Surrogate-Key headers.
 *
 * This is an allowlist of asset extensions rather than "any path ending in a
 * dot + chars", because page slugs legitimately contain dots — e.g. course
 * readable ids like /courses/course-v1:MITxT+5.601x. Matching "any extension"
 * wrongly classified those pages as static assets and stripped their caching.
 */
const STATIC_FILE_EXT =
  /\.(js|mjs|css|map|json|txt|xml|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot|webmanifest|wasm)$/i

/**
 * Returns true if the path is an HTML/page route that should receive
 * page-level caching headers (Cache-Control with s-maxage and the "html-pages"
 * Surrogate-Key). Both headers in proxy() are gated on this single test.
 *
 * Sitemaps are explicitly included despite having an .xml extension because
 * they are dynamically generated HTML-adjacent content, not static assets.
 */
export function isPageRoute(pathname: string): boolean {
  // Next.js internals (static chunks, image optimizer, ...)
  if (pathname.startsWith("/_next/")) return false
  // JSON healthcheck — exclude from page cache headers
  if (pathname === "/healthcheck") return false
  // Sitemaps are dynamically generated; treat them as page content
  if (pathname.startsWith("/sitemaps/")) return true
  // Known static-asset extensions are served as immutable files
  if (STATIC_FILE_EXT.test(pathname)) return false
  return true
}

/**
 * Next.js proxy (formerly "middleware"): sets the Cache-Control header at
 * request time so that NEXT_CACHE_S_MAXAGE_SECONDS is read from the Kubernetes
 * environment rather than baked into the Docker image at build time.
 *
 * next.config.js `headers()` runs at build time and cannot read env vars that
 * vary across environments (QA vs production). Proxy runs on the Node.js
 * runtime on every request, so process.env is always the live value.
 */
export function proxy(request: NextRequest) {
  if (!isPageRoute(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const sMaxage = process.env.NEXT_CACHE_S_MAXAGE_SECONDS || "1800"
  const cacheControl = `s-maxage=${sMaxage}, stale-if-error=86400, stale-while-revalidate=86400`

  const response = NextResponse.next()
  response.headers.set("Cache-Control", cacheControl)
  // Tag all HTML/page routes so Fastly can purge them on deploy without also
  // purging immutable /_next/static/ chunks. Driven by the same isPageRoute()
  // test as Cache-Control above, so the tag and the cache policy never diverge.
  response.headers.set("Surrogate-Key", "html-pages")
  return response
}

export const config = {
  matcher: [
    /*
     * Run on all paths except Next.js internals (_next/static, _next/image)
     * which are handled before proxy by the Next.js router. Static file
     * requests that slip through are filtered by isPageRoute() above.
     */
    "/((?!_next/).*)",
  ],
}
