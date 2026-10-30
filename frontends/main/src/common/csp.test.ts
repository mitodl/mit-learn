import { CSP_HEADER, contentSecurityPolicy, routeGroup } from "./csp"

/**
 * Parses a policy into { directive: sources[] }.
 *
 * Every assertion below goes through this rather than matching the header
 * string: whole-string assertions rot on every reorder and say nothing useful
 * about which directive is wrong when they fail.
 */
const parsePolicy = (header: string): Record<string, string[]> =>
  Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .filter(([directive]) => directive)
      .map(([directive, ...sources]) => [directive, sources]),
  )

const policyFor = (group: "site" | "embed") =>
  parsePolicy(contentSecurityPolicy(group))

const GROUPS = ["site", "embed"] as const

describe("routeGroup", () => {
  /**
   * Route groups are parenthesized and contribute nothing to the URL, so there
   * is no /embed/ prefix and a loose prefix match would hand the embed policy
   * to a large part of the catalogue. This table is the regression test for
   * that trap (RFC 0007 D8).
   */
  test.each([
    "/video/embed/123",
    "/video/embed/123/",
    "/podcast/embed/137277",
    // Not \d+: both pages Number()-parse the id and notFound() on a
    // non-integer, and that 404 renders from (embed)/not-found.tsx — still the
    // embed group. Under a digits-only matcher a third-party embed of a deleted
    // video would get the site policy and render as a blank frame.
    "/video/embed/abc",
    // next.config.js rewrites /static/:path* to /:path*, and the proxy runs
    // before that rewrite, so an embed page reached this way arrives with the
    // prefix still attached. It renders from (embed) and must be policed as
    // such, or 4b's frame-ancestors 'self' blanks it inside its embedder.
    "/static/video/embed/123",
    "/static/podcast/embed/137277",
  ])("treats %s as an embed route", (pathname) => {
    expect(routeGroup(pathname)).toBe("embed")
  })

  test.each([
    "/video/123",
    "/video/123/slug",
    "/podcast/137277",
    "/podcast/137277/podcast_episode/1",
    "/video-playlist/5",
    // The id segment is required: this resolves to (site)/video/[id] with
    // id="embed".
    "/video/embed",
    "/",
    "/search",
    "/courses/course-v1:MITxT+5.601x",
    // The /static prefix is stripped, not treated as a wildcard.
    "/static/video/123",
    "/static/search",
  ])("treats %s as a site route", (pathname) => {
    expect(routeGroup(pathname)).toBe("site")
  })
})

describe("contentSecurityPolicy", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APPZI_URL: "https://w.appzi.io/w.js?token=abc123",
      NEXT_PUBLIC_POSTHOG_API_HOST: "https://ph.ol.mit.edu",
      NEXT_PUBLIC_SENTRY_DSN: "https://deadbeef@sentry.example.com/4505",
      NEXT_PUBLIC_SENTRY_ENV: "production",
    }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  test("ships report-only, so chunk 3 blocks nothing", () => {
    expect(CSP_HEADER).toBe("Content-Security-Policy-Report-Only")
  })

  /**
   * The gap guard. default-src is what makes the policy fail closed, so a
   * directive nobody thought of is reported during the soak instead of
   * silently allowed — which is how media-src and font-src went missing from
   * earlier drafts of the design (RFC 0007 D10). Either set it, or name
   * everything.
   */
  test.each(GROUPS)(
    "%s policy leaves no fetch directive to chance",
    (group) => {
      const policy = policyFor(group)
      // Both halves assert unconditionally. An earlier version returned early
      // when default-src was present -- which it always is -- so the loop was
      // unreachable and this passed having asserted nothing at all.
      expect(policy["default-src"]).toEqual(["'self'"])
      for (const directive of [
        "media-src",
        "font-src",
        "connect-src",
        "img-src",
        "worker-src",
        "frame-src",
        "style-src",
        "script-src",
      ]) {
        expect(policy[directive]).toBeDefined()
      }
    },
  )

  /**
   * default-src 'self' absorbs a missing font-src or style-src, so the gap
   * guard above cannot notice one disappearing. Named here because the ROOT
   * app/layout.tsx loads the typekit stylesheet, which puts these on both
   * groups rather than only on (site).
   */
  test.each(GROUPS)("%s policy keeps the typekit hosts", (group) => {
    const policy = policyFor(group)
    expect(policy["font-src"]).toContain("https://use.typekit.net")
    expect(policy["style-src"]).toContain("https://use.typekit.net")
    expect(policy["style-src"]).toContain("https://p.typekit.net")
  })

  /**
   * The HLS guard. video.js/VHS plays HLS through MSE via
   * URL.createObjectURL(mediaSource) and spawns its transmuxer from a blob
   * worker, so dropping blob: from either directive kills video playback —
   * and only once a policy is enforced, which is long after this change ships.
   */
  test.each(GROUPS)(
    "%s policy keeps blob: for MSE and the VHS worker",
    (group) => {
      const policy = policyFor(group)
      expect(policy["media-src"]).toContain("blob:")
      expect(policy["worker-src"]).toContain("blob:")
    },
  )

  /**
   * D8's invariant. The embed document runs in Learn's origin on pages nobody
   * here watches, and its layout loads none of these. An invariant that exists
   * only in prose gets broken, so it is asserted: nothing may add an analytics
   * vendor to the (embed) layout without this failing.
   */
  test("embed script-src trusts no analytics vendor", () => {
    const scriptSrc = policyFor("embed")["script-src"].join(" ")
    for (const host of [
      "googletagmanager",
      "googleadservices",
      "connect.facebook.net",
      "jsdelivr",
      "unpkg",
      "appzi",
      "hs-scripts",
      "recaptcha",
      "gstatic",
      "posthog",
      "ph.ol.mit.edu",
    ]) {
      expect(scriptSrc).not.toContain(host)
    }
    expect(policyFor("embed")["script-src"]).toEqual([
      "'self'",
      "'unsafe-inline'",
      "https://www.youtube.com",
    ])
  })

  /**
   * Report-only reports frame-ancestors without blocking (CSP3 §4.2.5), so
   * these ship at their intended values now and start binding in 4a/4b. The
   * embed value is deliberately open — ShareDialog hands those URLs to
   * arbitrary third parties.
   */
  test("frame-ancestors is 'self' on site and * on embed", () => {
    expect(policyFor("site")["frame-ancestors"]).toEqual(["'self'"])
    expect(policyFor("embed")["frame-ancestors"]).toEqual(["*"])
  })

  test("site script-src carries the measured GTM host list", () => {
    const scriptSrc = policyFor("site")["script-src"]
    for (const source of [
      "https://www.googletagmanager.com",
      "https://www.googleadservices.com",
      "https://www.google.com",
      "https://connect.facebook.net",
      // Path-scoped: both CDNs serve the entire npm registry, so allowlisting
      // them by host would let any package execute here (RFC 0007 D11).
      "https://cdn.jsdelivr.net/npm/meta-capi-param-builder-clientjs/",
      "https://unpkg.com/meta-capi-param-builder-clientjs/",
    ]) {
      expect(scriptSrc).toContain(source)
    }
  })

  /**
   * reCAPTCHA's hosts come from Google's FAQ, not from this repo or the soak:
   * the library injects them, and the widget renders only when a HubSpot
   * dashboard setting enables it, so an empty sample would not prove them
   * unnecessary. connect-src https: already covers the last one — naming it
   * means a future tightening cannot break the challenge silently.
   */
  test("site policy carries reCAPTCHA's published hosts, path-scoped", () => {
    const policy = policyFor("site")
    expect(policy["script-src"]).toContain("https://www.google.com/recaptcha/")
    expect(policy["script-src"]).toContain("https://www.gstatic.com/recaptcha/")
    expect(policy["frame-src"]).toContain("https://www.google.com/recaptcha/")
    expect(policy["frame-src"]).toContain(
      "https://recaptcha.google.com/recaptcha/",
    )
    expect(policy["connect-src"]).toContain("https://www.google.com/recaptcha/")
  })

  test("site frame-src carries the players convertToEmbedUrl resolves", () => {
    const frameSrc = policyFor("site")["frame-src"]
    expect(frameSrc).toContain("https://www.youtube.com")
    expect(frameSrc).toContain("https://player.vimeo.com")
    expect(frameSrc).toContain("https://video.odl.mit.edu")
    // The GTM <noscript> iframe.
    expect(frameSrc).toContain("https://www.googletagmanager.com")
  })

  describe("per-environment hosts", () => {
    test("site script-src carries the Appzi origin, without its query string", () => {
      expect(policyFor("site")["script-src"]).toContain("https://w.appzi.io")
    })

    test.each(GROUPS)(
      "%s policy names no undefined host when Appzi is unset",
      (group) => {
        delete process.env.NEXT_PUBLIC_APPZI_URL
        expect(contentSecurityPolicy(group)).not.toContain("undefined")
        expect(policyFor(group)["script-src"]).not.toContain(
          "https://w.appzi.io",
        )
      },
    )

    test("a malformed Appzi URL is dropped rather than emitted", () => {
      process.env.NEXT_PUBLIC_APPZI_URL = "not a url"
      expect(contentSecurityPolicy("site")).not.toContain("not a url")
    })

    /**
     * posthog-js fetches its optional bundles (surveys, session recorder,
     * toolbar) as <script> from the configured host, so this is a script host
     * and not only a connect-src one. It appears nowhere in this repo as a
     * literal — the value is an env var and the loads happen inside the
     * library — which is exactly why it was missed the first time.
     */
    test("site script-src carries the PostHog host, and embed does not", () => {
      expect(policyFor("site")["script-src"]).toContain("https://ph.ol.mit.edu")
      expect(policyFor("embed")["script-src"]).not.toContain(
        "https://ph.ol.mit.edu",
      )
    })

    /**
     * The host is the component that needs checking, and the one an earlier
     * version of csp.ts did not check. new URL() percent-encodes ";" and ","
     * in the username and the path, but DECODES "%3B" into a literal ";" in
     * the host. In a CSP header ";" opens a new directive and "," opens a
     * whole second policy, so a mangled env var would have produced a
     * different policy that still parsed cleanly.
     */
    test.each([
      ["https://w.appzi.io%3Bscript-src/w.js", ";"],
      ["https://a,b.appzi.io/w.js", ","],
    ])("an Appzi host containing %s is dropped", (configured) => {
      process.env.NEXT_PUBLIC_APPZI_URL = configured
      const policy = policyFor("site")
      expect(policy["script-src"].join(" ")).not.toContain("appzi")
      expect(Object.keys(policy)).not.toContain("script-src;")
    })

    test.each([
      // Non-special scheme: URL.origin is the literal string "null", which
      // would otherwise be emitted as a bare source expression.
      "foo://w.appzi.io/w.js",
      "ftp://w.appzi.io/w.js",
    ])("a non-HTTP Appzi URL (%s) is dropped", (configured) => {
      process.env.NEXT_PUBLIC_APPZI_URL = configured
      expect(policyFor("site")["script-src"]).not.toContain("null")
      expect(contentSecurityPolicy("site")).not.toContain("appzi")
    })
  })

  describe("report-uri", () => {
    /**
     * Derived from the DSN rather than hardcoded, so it cannot drift from the
     * endpoint the Sentry SDK already uses.
     */
    test("is built from the Sentry DSN, with the environment appended", () => {
      const policy = policyFor("site")
      expect(policy["report-uri"]).toEqual([
        "https://sentry.example.com/api/4505/security/?sentry_key=deadbeef&sentry_environment=production",
      ])
    })

    test("omits the environment when none is configured", () => {
      delete process.env.NEXT_PUBLIC_SENTRY_ENV
      expect(policyFor("site")["report-uri"]).toEqual([
        "https://sentry.example.com/api/4505/security/?sentry_key=deadbeef",
      ])
    })

    /**
     * Local dev has no DSN. A report-uri containing "undefined" would make
     * every page load POST to a bogus URL, so the directive is omitted
     * entirely instead.
     */
    test.each(GROUPS)("%s policy omits it entirely with no DSN", (group) => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN
      const header = contentSecurityPolicy(group)
      expect(parsePolicy(header)["report-uri"]).toBeUndefined()
      expect(header).not.toContain("undefined")
    })

    test.each([
      "https://sentry.example.com/4505",
      "nonsense",
      "https://a@b/",
      // Host-borne header injection: ";" opens a new directive and "," opens a
      // second policy. new URL() decodes "%3B" back into a literal ";" here,
      // where it encodes it in the username and the path.
      "https://deadbeef@evil.com%3Bscript-src/4505",
      "https://deadbeef@a,b.com/4505",
      // Not an HTTP(S) endpoint.
      "ftp://deadbeef@sentry.example.com/4505",
    ])("is omitted rather than malformed for the unusable DSN %s", (dsn) => {
      process.env.NEXT_PUBLIC_SENTRY_DSN = dsn
      expect(policyFor("site")["report-uri"]).toBeUndefined()
    })

    /**
     * A self-hosted Sentry can sit under a path prefix. Rebuilding the
     * endpoint from the project id alone would post to
     * https://host/api/4505/security/ — a URL that resolves, 404s, and
     * reports nothing, which is a worse outcome than refusing the DSN.
     */
    test("preserves a path prefix rather than dropping or ignoring it", () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://deadbeef@sentry.example.com/sentry/4505"
      expect(policyFor("site")["report-uri"]).toEqual([
        "https://sentry.example.com/sentry/api/4505/security/?sentry_key=deadbeef&sentry_environment=production",
      ])
    })

    /**
     * `report-to` is omitted deliberately and this is the guard against it
     * being added back as a modernisation: browsers that support it IGNORE
     * report-uri, and Sentry cannot ingest the Reporting API's format
     * (getsentry/sentry#38940). Adding it empties the violation stream from
     * most traffic, silently. See RFC 0007 D6.
     */
    test.each(GROUPS)("%s policy sets no report-to", (group) => {
      const header = contentSecurityPolicy(group)
      expect(parsePolicy(header)["report-to"]).toBeUndefined()
    })
  })
})
