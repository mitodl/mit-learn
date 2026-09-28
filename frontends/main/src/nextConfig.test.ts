import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match"

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
})
