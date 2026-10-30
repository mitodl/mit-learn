import { env } from "@/env"

/**
 * Content-Security-Policy construction for learn.mit.edu.
 *
 * Full design: docs/rfcs/0007-security-headers.md. The decisions that shape
 * this file are D3 (script-src stays permissive), D6 (reporting), D7
 * (frame-ancestors), D8 (two policies), D10 (directive values) and D11 (the
 * measured script-src host list).
 *
 * Lives here rather than in next.config.js because `headers()` is evaluated at
 * build time and the policy contains per-environment hosts (Appzi, Sentry).
 * See the comment on proxy(), which exists for the same reason.
 */

/**
 * The two App Router route groups, which get independently tuned policies.
 *
 * `(embed)` serves exactly two paths — /video/embed/<id> and
 * /podcast/embed/<id> — which ShareDialog hands to users as a copy-paste
 * <iframe> snippet for arbitrary third-party sites. Its layout loads none of
 * the site's analytics vendors, so its script-src is much smaller (D8).
 */
export type RouteGroup = "site" | "embed"

/**
 * Route groups are parenthesized and contribute NOTHING to the URL, so there
 * is no /embed/ prefix to match on. Three things this encodes deliberately:
 *
 * - The id segment is REQUIRED. /video/embed with no id resolves to
 *   (site)/video/[id] with id="embed", so it is a site route.
 * - The id matches ANY segment, not just digits. Both pages Number()-parse the
 *   id and notFound() on a non-positive non-integer, and that 404 renders from
 *   (embed)/not-found.tsx — still in the embed group. A \d+ matcher would give
 *   it the site policy, so a third-party embed of a deleted video would render
 *   as a blank frame instead of the embed not-found page.
 * - Nothing deeper matches. /video/embed/123/x falls through to (site).
 */
const EMBED_ROUTE = /^\/(?:video|podcast)\/embed\/[^/]+\/?$/

/**
 * next.config.js rewrites /static/:path* to /:path*, and the proxy runs BEFORE
 * that rewrite, so an embed page reached through the legacy /static prefix
 * arrives here as /static/video/embed/<id>. Matching the raw pathname would
 * hand that page the SITE policy — and once 4b enforces, frame-ancestors
 * 'self', blanking it inside whatever third-party page framed it.
 */
const STATIC_REWRITE_PREFIX = /^\/static(?=\/)/

export const routeGroup = (pathname: string): RouteGroup =>
  EMBED_ROUTE.test(pathname.replace(STATIC_REWRITE_PREFIX, ""))
    ? "embed"
    : "site"

/** Report-only for now; chunks 4a and 4b flip the groups to enforcing. */
export const CSP_HEADER = "Content-Security-Policy-Report-Only"

const SELF = "'self'"
const NONE = "'none'"
const UNSAFE_INLINE = "'unsafe-inline'"

const YOUTUBE = "https://www.youtube.com"
const TYPEKIT_CSS = "https://use.typekit.net"
const TYPEKIT_P = "https://p.typekit.net"

/**
 * Script sources the GTM container may load, MEASURED from the production
 * container rather than inferred from this repo (RFC 0007 D11 — the container
 * is public and the procedure is recorded there so it can be re-run).
 *
 * The first three are Google's published values for GTM, GA4 and Google Ads
 * (https://developers.google.com/tag-platform/security/guides/csp). The last
 * three are the Meta Pixel template's own `inject_script` permission block,
 * which is the authoritative declaration of what that template may load.
 *
 * jsDelivr and unpkg serve the ENTIRE npm registry, so they are path-scoped to
 * the one package rather than allowlisted by host — otherwise any npm package
 * could execute here, which gives away most of what an allowlist is for. CSP
 * matches a path prefix when the source ends in "/". Caveat: the path is NOT
 * re-checked after a redirect, so this constrains the initial fetch only.
 *
 * The container changes without a deploy here, so a new script host can appear
 * at any time. That is the ongoing cost D11 accepts; the report-only soak is
 * what surfaces it before chunk 4b makes it binding.
 */
const GTM_SCRIPT_SOURCES = [
  "https://www.googletagmanager.com",
  "https://www.googleadservices.com",
  "https://www.google.com",
  "https://connect.facebook.net",
  "https://cdn.jsdelivr.net/npm/meta-capi-param-builder-clientjs/",
  "https://unpkg.com/meta-capi-param-builder-clientjs/",
]

/**
 * reCAPTCHA's hosts, taken from Google's FAQ
 * (https://developers.google.com/recaptcha/docs/faq) rather than from this
 * repo or from the soak. None appear as literals here — react-google-recaptcha
 * injects them — and the widget renders only when a HubSpot dashboard setting
 * enables it, so an empty violation sample would not prove they are
 * unnecessary.
 *
 * Path-scoped as Google publishes them. recaptcha.google.com is a third host,
 * needed for the challenge iframe, and appears in no inference made from this
 * codebase.
 */
const RECAPTCHA_SCRIPT = [
  "https://www.google.com/recaptcha/",
  "https://www.gstatic.com/recaptcha/",
]
const RECAPTCHA_FRAME = [
  "https://www.google.com/recaptcha/",
  "https://recaptcha.google.com/recaptcha/",
]
const RECAPTCHA_CONNECT = "https://www.google.com/recaptcha/"

/**
 * HubSpot's loader, from (site)/layout.tsx. The loader pulls further HubSpot
 * hosts at runtime; unlike reCAPTCHA and GTM those are left for the soak to
 * enumerate, because this script runs on every site page view and so WILL
 * appear in the sample. An empty sample here really would mean absent.
 */
const HUBSPOT_SCRIPT = "https://js.hs-scripts.com"

/**
 * Hosts framed by (site): the GTM <noscript> iframe, and the players
 * convertToEmbedUrl() resolves in common/utils.ts. (embed) only ever frames
 * YouTube — VideoResourcePlayer reaches YouTubeIframePlayer for a
 * video/youtube source and renders video.js natively otherwise.
 */
const SITE_FRAME_SOURCES = [
  YOUTUBE,
  "https://player.vimeo.com",
  "https://video.odl.mit.edu",
  "https://www.googletagmanager.com",
]

/**
 * Hostname, optionally with a port. Deliberately narrower than the URL spec —
 * it rejects IPv6 literals, which no configured value here is.
 */
const SAFE_HOST = /^[a-zA-Z0-9.-]+(?::\d+)?$/

/**
 * Reduces a configured URL to an origin safe to name in a response header, or
 * null if it is anything else.
 *
 * The host is the component that needs checking, which is easy to get wrong:
 * new URL() percent-encodes ";" and "," in the username and the path, but in
 * the HOST it DECODES "%3B" back into a literal ";". In a CSP header ";" starts
 * a new directive and "," starts a whole second policy, so an unchecked host
 * turns a mangled env var into a different policy that still looks fine.
 *
 * Non-https schemes are rejected too. A non-special scheme makes URL.origin the
 * literal string "null", which would otherwise be emitted as a bare source.
 */
const safeOrigin = (configured: string | undefined): string | null => {
  const trimmed = configured?.trim()
  if (!trimmed) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
  if (!SAFE_HOST.test(parsed.host)) return null
  return parsed.origin
}

/**
 * The Appzi feedback widget's origin, from NEXT_PUBLIC_APPZI_URL (site only).
 * Reduced to an origin because the env var is a full script URL; the query
 * string it carries is not a CSP source expression. This is the per-environment
 * host that keeps the policy out of next.config.js (D2).
 */
const appziSource = (): string[] => {
  const origin = safeOrigin(env("NEXT_PUBLIC_APPZI_URL"))
  return origin ? [origin] : []
}

/**
 * PostHog's host, from NEXT_PUBLIC_POSTHOG_API_HOST (site only — the provider
 * is mounted from (site)/SiteProviders.tsx and nowhere else).
 *
 * This is a SCRIPT host, not only a connect-src one. posthog-js fetches its
 * optional bundles — surveys, the session recorder, the toolbar — as <script>
 * from the configured host at runtime, so a policy that named it under
 * connect-src alone would block them at enforce. It appears nowhere in this
 * repo as a literal, which is why it was missed: the value is an environment
 * variable (production proxies PostHog at an MIT host) and the loads happen
 * inside the library.
 */
const posthogSource = (): string[] => {
  const origin = safeOrigin(env("NEXT_PUBLIC_POSTHOG_API_HOST"))
  return origin ? [origin] : []
}

/**
 * Sentry's security endpoint, DERIVED from NEXT_PUBLIC_SENTRY_DSN rather than
 * hardcoded, so it cannot drift from the DSN the Sentry SDK already uses.
 *
 * DSN:      https://<publicKey>@<host>/<projectId>
 * Endpoint: https://<host>/api/<projectId>/security/?sentry_key=<publicKey>
 *
 * Returns null when there is no usable DSN — local dev has none, and a
 * report-uri containing "undefined" would make every page load POST to a bogus
 * URL. The policy omits the directive entirely in that case.
 *
 * Every component is operator-supplied and lands verbatim in a response header,
 * so every component is checked: the host by safeOrigin() above, the key and
 * project id as alphanumeric here, and any path prefix a segment at a time.
 *
 * The prefix is PRESERVED rather than discarded. A self-hosted Sentry can live
 * under one (https://key@host/sentry/4505), and rebuilding the endpoint from
 * the project id alone would post to https://host/api/4505/security/ — a URL
 * that resolves, 404s, and reports nothing, which is worse than refusing.
 */
const sentryReportUri = (): string | null => {
  const dsn = env("NEXT_PUBLIC_SENTRY_DSN")?.trim()
  if (!dsn) return null

  const origin = safeOrigin(dsn)
  if (!origin) return null

  let parsed: URL
  try {
    parsed = new URL(dsn)
  } catch {
    return null
  }

  const publicKey = parsed.username
  const segments = parsed.pathname.split("/").filter(Boolean)
  const projectId = segments.pop() ?? ""
  if (!/^[a-zA-Z0-9]+$/.test(publicKey) || !/^[a-zA-Z0-9]+$/.test(projectId)) {
    return null
  }
  if (!segments.every((segment) => /^[a-zA-Z0-9._-]+$/.test(segment))) {
    return null
  }

  const prefix = segments.length > 0 ? `/${segments.join("/")}` : ""
  const endpoint = new URL(`${prefix}/api/${projectId}/security/`, origin)
  endpoint.searchParams.set("sentry_key", publicKey)

  // Separates RC from production in one shared project.
  const environment = env("NEXT_PUBLIC_SENTRY_ENV")?.trim()
  if (environment && /^[a-zA-Z0-9_-]+$/.test(environment)) {
    endpoint.searchParams.set("sentry_environment", environment)
  }

  return endpoint.toString()
}

/**
 * Directives in emission order. Values follow RFC 0007 D10, which records why
 * each of the permissive ones has to be permissive; the ones most likely to be
 * "tidied up" by a future reader are:
 *
 * - media-src/worker-src blob: — MANDATORY. video.js/VHS plays HLS through MSE
 *   via URL.createObjectURL(mediaSource) and spawns its transmuxer from a blob
 *   worker. Dropping either kills HLS, and only once a policy is enforced.
 * - connect-src https: — VHS fetches the .m3u8 and its segments from a
 *   CloudFront host not knowable here. Chrome fetches them by XHR
 *   (connect-src); Safari uses native HLS, where the media element fetches them
 *   (media-src). Both must stay permissive — testing one browser proves nothing
 *   about the other.
 * - img-src https: — podcast cover art and the video.js poster are raw
 *   cross-origin URLs, not routed through the image optimizer.
 *
 * default-src 'self' is set so the policy fails closed: any directive this
 * list forgets is reported during the soak rather than silently allowed. That
 * is how media-src and font-src went missing from earlier drafts.
 */
const directives = (group: RouteGroup): Record<string, string[]> => {
  const isSite = group === "site"

  return {
    "default-src": [SELF],
    "base-uri": [SELF],
    "object-src": [NONE],
    "form-action": [SELF],
    /**
     * Report-only reports this without blocking (CSP3 §4.2.5 — CSP2's "MUST be
     * ignored when monitoring" was dropped), so the soak is what tells us who
     * actually frames the site before 4b makes 'self' binding. The embed routes
     * are deliberately open: ShareDialog hands those URLs to arbitrary third
     * parties. "*" is written explicitly rather than omitted — mechanically
     * identical, since frame-ancestors does not fall back to default-src, but
     * it is the difference between "deliberately open" and "someone forgot".
     */
    "frame-ancestors": isSite ? [SELF] : ["*"],
    /**
     * 'unsafe-inline' is forced on BOTH groups by Next's App Router, which
     * emits a per-page inline <script> carrying the RSC flight payload. Hashes
     * are infeasible (the content differs per render) and a nonce cannot
     * survive the Fastly page cache, where one HTML body is served to every
     * viewer. See D3 and mitodl/hq#14083 — this is not an XSS fix.
     *
     * The embed group gets 'self' plus YouTube only. Its layout loads no GTM,
     * no Appzi, no HubSpot, no reCAPTCHA and no PostHog, and nothing may add
     * them (D8's invariant, locked by a test).
     */
    "script-src": isSite
      ? [
          SELF,
          UNSAFE_INLINE,
          YOUTUBE,
          ...GTM_SCRIPT_SOURCES,
          // Subsumed by GTM's bare https://www.google.com above. Listed anyway
          // so removing the Ads entry cannot silently break reCAPTCHA.
          ...RECAPTCHA_SCRIPT,
          HUBSPOT_SCRIPT,
          ...appziSource(),
          ...posthogSource(),
        ]
      : [SELF, UNSAFE_INLINE, YOUTUBE],
    // Emotion and MUI inject <style> and inline style=; MITLearnGlobalStyles is
    // in the embed layout too, and the root layout loads the typekit stylesheet
    // for both groups.
    "style-src": [SELF, UNSAFE_INLINE, TYPEKIT_CSS, TYPEKIT_P],
    "img-src": [SELF, "data:", "blob:", "https:"],
    "font-src": [SELF, "data:", TYPEKIT_CSS],
    // https: already covers reCAPTCHA; naming it means a future tightening
    // cannot break the challenge without noticing. An accidental dependency is
    // not a satisfied one.
    "connect-src": isSite
      ? [SELF, "https:", RECAPTCHA_CONNECT]
      : [SELF, "https:"],
    "media-src": [SELF, "https:", "blob:"],
    "worker-src": [SELF, "blob:"],
    "frame-src": isSite
      ? [SELF, ...SITE_FRAME_SOURCES, ...RECAPTCHA_FRAME]
      : [SELF, YOUTUBE],
  }
}

/**
 * Builds the policy for a route group.
 *
 * Depends only on the route group and on environment variables — never on
 * anything per-request. That is load-bearing: learn.mit.edu HTML is cached
 * per-URL at Fastly, so a policy that varied by request header would need a
 * Vary and would wreck the hit ratio D3 exists to protect. Asserted in
 * proxy.test.ts rather than checked afterwards on a metric.
 */
export const contentSecurityPolicy = (group: RouteGroup): string => {
  const policy = Object.entries(directives(group)).map(
    ([directive, sources]) => `${directive} ${sources.join(" ")}`,
  )

  /**
   * report-uri ONLY. `report-to` is omitted DELIBERATELY — do not "modernise"
   * this by adding it.
   *
   * Browsers that support report-to IGNORE report-uri; the two are not
   * additive. The Reporting API posts application/reports+json, a different
   * body shape, and Sentry cannot ingest it (getsentry/sentry#38940, open since
   * 2022, confirmed paused by Sentry in Nov 2025). report-to reached Baseline
   * in March 2026, so adding it would make Chromium post a format Sentry drops:
   * no console error, no Sentry error, and an empty violation stream from most
   * of our traffic — which is indistinguishable from "no violations", the one
   * reading this soak exists to produce. See RFC 0007 D6.
   */
  const reportUri = sentryReportUri()
  if (reportUri) {
    policy.push(`report-uri ${reportUri}`)
  }

  return policy.join("; ")
}
