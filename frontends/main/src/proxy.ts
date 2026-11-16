import { type NextRequest, NextResponse } from "next/server"
import { getCacheSMaxageSeconds } from "@/common/config"

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
 * Page routes the CDN must never cache. A program letter can be revoked, and
 * nothing purges its cached HTML (which carries the learner's name in the page
 * and its og tags), so a shared cache would keep serving it after revocation.
 */
const UNCACHED_PAGE_PREFIXES = ["/program_letter/"]

// Matches /courses/<readable_id> — readable_ids contain colons and + but no slashes.
const COURSE_PATTERN = /^\/courses\/([^/?]+)$/
// Matches /courses/p/<readable_id> — despite the /courses/ prefix this is a
// *program* page (ProgramAsCoursePage); the readable_id is a program readable_id.
const PROGRAM_AS_COURSE_PATTERN = /^\/courses\/p\/([^/?]+)$/
// Matches /programs/<readable_id>
const PROGRAM_PATTERN = /^\/programs\/([^/?]+)$/

/**
 * Safely decode a URL path segment for use in a response header value.
 *
 * Returns null instead of throwing when:
 *   - percent-encoding is malformed (decodeURIComponent would throw URIError)
 *   - the decoded value contains control characters (\r, \n, \0, ...) or
 *     characters above U+00FF, either of which would cause Headers.set() to
 *     throw. Latin-1 (U+0080-U+00FF) is rejected too, for simplicity: page
 *     paths and readable ids are ASCII.
 */
function safeDecodeSegment(segment: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    return null
  }
  // HTTP header values must only contain visible ASCII + SP + HT (RFC 7230 §3.2.6).
  // Reject anything else: control chars allow header injection, and Headers.set()
  // throws on any character above U+00FF (e.g. a decoded en dash).
  // eslint-disable-next-line no-control-regex
  if (/[^\x09\x20-\x7E]/.test(decoded)) {
    return null
  }
  return decoded
}

/**
 * Derives the per-page `path:` Surrogate-Key tag from the request path, or
 * returns null if the path can't be decoded into a header value.
 *
 * Fastly caches each whitelisted query-param variant of a page, and its RSC
 * payload, as a separate object. All of them share this tag, so the backend
 * can purge every variant of a page at once (main.utils.path_surrogate_key
 * builds the same tag from a URL).
 */
export function pathSurrogateKey(pathname: string): string | null {
  const decoded = safeDecodeSegment(pathname)
  return decoded === null ? null : `path:${decoded}`
}

/**
 * Derives a per-item MITxOnline Surrogate-Key tag from the request path, or
 * returns null if the path is not a MITxOnline course or program page.
 *
 * Key format (matches what MITxOnline purges):
 *   mitxonline:course:<readable_id>   — /courses/<readable_id>
 *   mitxonline:program:<readable_id>  — /programs/<readable_id>
 *                                     — /courses/p/<readable_id>
 *                                       (/courses/p/ renders ProgramAsCoursePage;
 *                                        the readable_id is a program readable_id)
 *
 * NOTE: Surrogate-Key headers must be set here rather than in page.tsx because
 * Next.js commits response headers before any page/layout code runs (to begin
 * streaming). By the time page.tsx executes, headers have already been sent.
 */
export function mitxonlineSurrogateKey(pathname: string): string | null {
  const courseMatch = COURSE_PATTERN.exec(pathname)
  if (courseMatch) {
    const readableId = safeDecodeSegment(courseMatch[1])
    if (readableId !== null) {
      return `mitxonline:course:${readableId}`
    }
  }

  const programMatch =
    PROGRAM_AS_COURSE_PATTERN.exec(pathname) ?? PROGRAM_PATTERN.exec(pathname)
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
 * request time so the CDN TTL is read from the Kubernetes environment rather
 * than baked into the Docker image at build time.
 *
 * next.config.js `headers()` runs at build time and cannot read env vars that
 * vary across environments (QA vs production). Proxy always runs on the
 * Node.js runtime, on every request, so the env read is always the live value.
 *
 * Never redirect or reject non-page requests here. The image optimizer
 * fetches local images (/images/*, /_next/static/media/*) by routing an
 * internal request through proxy with no Host or X-Forwarded-Proto header.
 * An https redirect in the old middleware.ts broke every local image that
 * way in Oct 2025 ("isn't a valid image ... received null").
 */
export function proxy(request: NextRequest) {
  if (!isPageRoute(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  if (
    UNCACHED_PAGE_PREFIXES.some((prefix) =>
      request.nextUrl.pathname.startsWith(prefix),
    )
  ) {
    const response = NextResponse.next()
    response.headers.set("Cache-Control", "private, no-store")
    return response
  }

  const cacheControl = `s-maxage=${getCacheSMaxageSeconds()}, stale-if-error=86400, stale-while-revalidate=86400`

  const response = NextResponse.next()
  response.headers.set("Cache-Control", cacheControl)

  // All page routes share the html-pages tag so Fastly can purge them on
  // deploy, and each carries a path: tag so one page can be purged with all
  // its query variants. MITxOnline course/program pages additionally carry a
  // per-item tag so MITxOnline can invalidate individual product pages on
  // data change.
  const keys = [
    "html-pages",
    pathSurrogateKey(request.nextUrl.pathname),
    mitxonlineSurrogateKey(request.nextUrl.pathname),
  ].filter((key) => key !== null)
  response.headers.set("Surrogate-Key", keys.join(" "))

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
