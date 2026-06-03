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

// Matches /courses/<readable_id> — readable_ids contain colons and + but no slashes.
const COURSE_PATTERN = /^\/courses\/([^/?]+)$/
// Matches /courses/p/<readable_id>
const COURSE_P_PATTERN = /^\/courses\/p\/([^/?]+)$/
// Matches /programs/<readable_id>
const PROGRAM_PATTERN = /^\/programs\/([^/?]+)$/

/**
 * Safely decode a URL path segment for use in a response header value.
 *
 * Returns null instead of throwing when:
 *   - percent-encoding is malformed (decodeURIComponent would throw URIError)
 *   - the decoded value contains characters invalid in HTTP header values
 *     (control characters, \r, \n, \0) which would cause Headers.set() to throw
 */
function safeDecodeSegment(segment: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    return null
  }
  // HTTP header values must only contain visible ASCII + SP + HT (RFC 7230 §3.2.6).
  // Reject anything with control chars (\x00-\x1F except \x09, or \x7F) to prevent
  // header injection and avoid Headers.set() throwing.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0A-\x1F\x7F]/.test(decoded)) {
    return null
  }
  return decoded
}

/**
 * Derives a per-item MITxOnline Surrogate-Key tag from the request path, or
 * returns null if the path is not a MITxOnline course or program page.
 *
 * Key format (matches what MITxOnline purges):
 *   mitxonline:course:<readable_id>   — /courses/<readable_id>
 *                                     — /courses/p/<readable_id>
 *   mitxonline:program:<readable_id>  — /programs/<readable_id>
 *
 * NOTE: Surrogate-Key headers must be set here rather than in page.tsx because
 * Next.js commits response headers before any page/layout code runs (to begin
 * streaming). By the time page.tsx executes, headers have already been sent.
 */
export function mitxonlineSurrogateKey(pathname: string): string | null {
  const courseMatch =
    COURSE_P_PATTERN.exec(pathname) ?? COURSE_PATTERN.exec(pathname)
  if (courseMatch) {
    const readableId = safeDecodeSegment(courseMatch[1])
    if (readableId !== null) {
      return `mitxonline:course:${readableId}`
    }
  }

  const programMatch = PROGRAM_PATTERN.exec(pathname)
  if (programMatch) {
    const readableId = safeDecodeSegment(programMatch[1])
    if (readableId !== null) {
      return `mitxonline:program:${readableId}`
    }
  }

  return null
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

  // All page routes share the html-pages tag so Fastly can purge them on
  // deploy. MITxOnline course/program pages additionally carry a per-item tag
  // so MITxOnline can invalidate individual product pages on data change.
  const itemKey = mitxonlineSurrogateKey(request.nextUrl.pathname)
  const surrogateKey = itemKey ? `html-pages ${itemKey}` : "html-pages"
  response.headers.set("Surrogate-Key", surrogateKey)

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
