import { NextRequest } from "next/server"
import { isPageRoute, proxy } from "./proxy"

describe("isPageRoute", () => {
  test.each([
    "/",
    "/about",
    "/search",
    // Course/program readable ids legitimately contain dots and can end in a
    // dotted suffix (e.g. 5.601x). These are HTML pages, not static assets.
    "/courses/course-v1:MITxT+5.601x",
    "/programs/program-v1:MITxT+18.01x",
    // Sitemaps are dynamically generated and tagged for purge-on-deploy.
    "/sitemaps/products.xml",
    "/sitemaps/sitemap-index.xml",
  ])("treats %s as a page route", (pathname) => {
    expect(isPageRoute(pathname)).toBe(true)
  })

  test.each([
    // JSON healthcheck
    "/healthcheck",
    // Static assets served as immutable files
    "/favicon.ico",
    "/images/mit-dome-2.jpg",
    "/static/app.css",
    // Anything under the Next.js internals tree, regardless of extension —
    // including extensionless endpoints like the image optimizer.
    "/_next/static/chunk.js",
    "/_next/image",
  ])("treats %s as a non-page route", (pathname) => {
    expect(isPageRoute(pathname)).toBe(false)
  })
})

describe("proxy", () => {
  const makeRequest = (pathname: string) =>
    new NextRequest(new URL(pathname, "https://learn.mit.edu"))

  test("tags page routes with both Cache-Control and Surrogate-Key", () => {
    const response = proxy(makeRequest("/courses/course-v1:MITxT+5.601x"))
    expect(response.headers.get("Surrogate-Key")).toBe("html-pages")
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=")
  })

  test("leaves non-page routes untagged", () => {
    const response = proxy(makeRequest("/healthcheck"))
    expect(response.headers.get("Surrogate-Key")).toBeNull()
    expect(response.headers.get("Cache-Control")).toBeNull()
  })
})
