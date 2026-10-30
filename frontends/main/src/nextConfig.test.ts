import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match"
import { buildCustomRoute } from "next/dist/server/lib/router-utils/filesystem"

/**
 * The image optimizer fetches local images through the Next.js router, so a
 * redirect matching these paths breaks every optimized local image (see the
 * comment on proxy() in proxy.ts). `has`/`missing` conditions are ignored
 * here on purpose: the optimizer's request carries no headers, so a rule that
 * matches only on headers could still catch it.
 */
const LOCAL_IMAGE_PATHS = [
  "/images/hero/hero-1.png",
  "/static/images/hero/hero-1.png",
  "/_next/static/media/graduate.05tvlwc2-um9z.png",
]

describe("next.config.js redirects", () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Skip validateEnv(), as the Docker build does.
    process.env = { ...originalEnv, NEXT_BUILD_CI: "1" }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  test.each(LOCAL_IMAGE_PATHS)("no redirect matches %s", async (pathname) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextConfig = require("../next.config.js")
    const redirects: { source: string }[] = await nextConfig.redirects()
    expect(redirects.length).toBeGreaterThan(0)
    const matching = redirects.filter(({ source }) =>
      getPathMatch(source)(pathname),
    )
    expect(matching).toEqual([])
  })

  test("/universal-learning/ai redirects permanently to /organizational-learning", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextConfig = require("../next.config.js")
    const redirects: { source: string; destination: string }[] =
      await nextConfig.redirects()
    const matching = redirects.filter(({ source }) =>
      getPathMatch(source)("/universal-learning/ai"),
    )
    expect(matching).toEqual([
      {
        source: "/universal-learning/ai",
        destination: "/organizational-learning",
        permanent: true,
      },
    ])
  })
})

type HeaderRule = {
  source: string
  headers: { key: string; value: string }[]
}

/**
 * Collapses every matching headers() rule into one map, so tests assert on
 * what a response carries rather than on which rule supplied it. Last-wins
 * mirrors the router, where header rules are non-terminal.
 *
 * Uses Next's own `buildCustomRoute` rather than a bare `getPathMatch`: Next
 * compiles header rules with `strict: true` plus a `regexModifier`, so a bare
 * matcher is looser than what actually ships.
 */
const headersFor = (rules: HeaderRule[], pathname: string) =>
  Object.fromEntries(
    rules
      .filter((rule) =>
        buildCustomRoute("header", rule, "", false).match(pathname),
      )
      .flatMap(({ headers }) => headers.map(({ key, value }) => [key, value])),
  )

describe("next.config.js headers", () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Skip validateEnv(), as the Docker build does.
    process.env = { ...originalEnv, NEXT_BUILD_CI: "1" }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  const getRules = async (): Promise<HeaderRule[]> => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextConfig = require("../next.config.js")
    return nextConfig.headers()
  }

  /**
   * `/` and a nested page confirm `/:path*` spans both -- not because `*`
   * makes the segment optional (`strict: true` disables that), but because
   * `buildCustomRoute`'s `regexModifier` rewrites the trailing `$` to
   * `(?:\/)?$`. The asset paths are why the rule isn't scoped to pages.
   */
  test.each([
    "/",
    "/search",
    "/c/department/music",
    "/images/hero/hero-1.png",
    "/favicon.ico",
    "/_next/static/media/graduate.05tvlwc2-um9z.png",
  ])("security headers are present on %s", async (pathname) => {
    const headers = headersFor(await getRules(), pathname)
    expect(headers["X-Content-Type-Options"]).toBe("nosniff")
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
  })

  /**
   * Config-wide, where the test above samples paths. Catches what a sample
   * cannot: a SECOND Referrer-Policy rule anywhere in headers(), or a rule
   * matching some unsampled path with a different value.
   */
  test("exactly one Referrer-Policy rule exists, with the intended value", async () => {
    const rules = await getRules()
    const values = rules
      .flatMap(({ headers }) => headers)
      .filter(({ key }) => key === "Referrer-Policy")
      .map(({ value }) => value)

    expect(values).toEqual(["strict-origin-when-cross-origin"])
  })

  /**
   * The security rule is additive. Cache-Control for these two paths is a
   * separate concern and must survive alongside it.
   */
  test.each([
    ["/images/hero/hero-1.png", "s-maxage=31536000"],
    ["/favicon.ico", "s-maxage=31536000"],
  ])("%s keeps its Cache-Control", async (pathname, expected) => {
    const headers = headersFor(await getRules(), pathname)
    expect(headers["Cache-Control"]).toBe(expected)
  })

  /**
   * Framing is decided per route group in src/common/csp.ts, because the
   * (embed) routes must stay framable by any origin — ShareDialog hands those
   * URLs to arbitrary third parties.
   *
   * The existing /:path* rule here already carries nosniff and Referrer-Policy,
   * so it is the obvious place to add X-Frame-Options, and doing so would send
   * SAMEORIGIN to the embed routes too and blank every third-party embed.
   * X-Frame-Options has no reporting channel and no portable "any origin"
   * value, so nothing would catch it: no violation report, no console error,
   * and the breakage happens on someone else's page. See RFC 0007 D9.
   */
  test("no framing header is emitted for any source", async () => {
    const framing = (await getRules())
      .flatMap(({ headers }) => headers)
      .filter(({ key }) =>
        /^(x-frame-options|content-security-policy)/i.test(key),
      )

    expect(framing).toEqual([])
  })

  /**
   * Per-request Cache-Control belongs to src/proxy.ts, which reads the TTL
   * from the environment at request time. A second source here would diverge
   * from it silently.
   */
  test("page routes get no Cache-Control from the build-time config", async () => {
    const headers = headersFor(await getRules(), "/search")
    expect(headers["Cache-Control"]).toBeUndefined()
  })
})

describe("next.config.js poweredByHeader", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, NEXT_BUILD_CI: "1" }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  test("is disabled, so responses carry no X-Powered-By", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextConfig = require("../next.config.js")
    expect(nextConfig.poweredByHeader).toBe(false)
  })
})
