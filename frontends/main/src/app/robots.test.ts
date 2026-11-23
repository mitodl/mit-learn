import { PHASE_PRODUCTION_BUILD } from "next/constants"
import robots from "./robots"

const ORIGIN = "http://test.learn.odl.local:8062"

describe("robots.txt", () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
  })

  it("lists the main sitemap index and the OCW course sitemap index when indexing is on", () => {
    process.env = { ...originalEnv, MITOL_NOINDEX: "false" }

    expect(robots().sitemap).toEqual([
      `${ORIGIN}/sitemaps/sitemap-index.xml`,
      `${ORIGIN}/sitemap-index-courses-o.xml`,
    ])
  })

  it.each([undefined, "true"])(
    "disallows everything and lists no sitemap when MITOL_NOINDEX is %s",
    (noindex) => {
      process.env = { ...originalEnv, MITOL_NOINDEX: noindex }

      expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } })
    },
  )

  it("disallows everything during the production build", () => {
    process.env = {
      ...originalEnv,
      MITOL_NOINDEX: "false",
      NEXT_PHASE: PHASE_PRODUCTION_BUILD,
    }

    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } })
  })
})
