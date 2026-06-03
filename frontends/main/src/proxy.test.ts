import { NextRequest } from "next/server"
import { isPageRoute, mitxonlineSurrogateKey, proxy } from "./proxy"

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

describe("mitxonlineSurrogateKey", () => {
  describe("course pages", () => {
    it("returns mitxonline:course key for /courses/:readable_id", () => {
      expect(
        mitxonlineSurrogateKey("/courses/course-v1:MITx+6.00.1x+3T2019"),
      ).toBe("mitxonline:course:course-v1:MITx+6.00.1x+3T2019")
    })

    it("returns mitxonline:course key for /courses/p/:readable_id", () => {
      expect(
        mitxonlineSurrogateKey("/courses/p/course-v1:MITx+6.00.1x+3T2019"),
      ).toBe("mitxonline:course:course-v1:MITx+6.00.1x+3T2019")
    })

    it("handles URL-encoded readable_id", () => {
      const encoded = encodeURIComponent("course-v1:MITx+6.00.1x+3T2019")
      expect(mitxonlineSurrogateKey(`/courses/${encoded}`)).toBe(
        "mitxonline:course:course-v1:MITx+6.00.1x+3T2019",
      )
    })
  })

  describe("program pages", () => {
    it("returns mitxonline:program key for /programs/:readable_id", () => {
      expect(mitxonlineSurrogateKey("/programs/program-v1:MITx+SDS")).toBe(
        "mitxonline:program:program-v1:MITx+SDS",
      )
    })
  })

  describe("non-product pages", () => {
    it.each(["/", "/search", "/about", "/courses", "/programs"])(
      "returns null for %s",
      (pathname) => {
        expect(mitxonlineSurrogateKey(pathname)).toBeNull()
      },
    )
  })

  describe("hostile URL segments — regression: Headers.set() crash on control characters", () => {
    it("returns null without throwing on malformed percent-encoding in course path", () => {
      // %GG is not valid percent-encoding — decodeURIComponent would throw URIError
      expect(() => mitxonlineSurrogateKey("/courses/%GG")).not.toThrow()
      expect(mitxonlineSurrogateKey("/courses/%GG")).toBeNull()
    })

    it("returns null without throwing on malformed percent-encoding in program path", () => {
      expect(() => mitxonlineSurrogateKey("/programs/%GG")).not.toThrow()
      expect(mitxonlineSurrogateKey("/programs/%GG")).toBeNull()
    })

    it("returns null on CRLF in course path (%0D%0A decodes to \\r\\n)", () => {
      // Without safeDecodeSegment, passing this to Headers.set() would throw TypeError
      expect(() =>
        mitxonlineSurrogateKey("/courses/foo%0D%0AX-Injected%3A+yes"),
      ).not.toThrow()
      expect(
        mitxonlineSurrogateKey("/courses/foo%0D%0AX-Injected%3A+yes"),
      ).toBeNull()
    })

    it("returns null on CRLF in program path", () => {
      expect(() =>
        mitxonlineSurrogateKey("/programs/foo%0D%0AX-Injected%3A+yes"),
      ).not.toThrow()
      expect(
        mitxonlineSurrogateKey("/programs/foo%0D%0AX-Injected%3A+yes"),
      ).toBeNull()
    })

    it("returns null on null byte in course path", () => {
      expect(() => mitxonlineSurrogateKey("/courses/foo%00bar")).not.toThrow()
      expect(mitxonlineSurrogateKey("/courses/foo%00bar")).toBeNull()
    })

    it("returns null on null byte in program path", () => {
      expect(() => mitxonlineSurrogateKey("/programs/foo%00bar")).not.toThrow()
      expect(mitxonlineSurrogateKey("/programs/foo%00bar")).toBeNull()
    })
  })
})

describe("proxy", () => {
  const makeRequest = (pathname: string) =>
    new NextRequest(new URL(pathname, "https://learn.mit.edu"))

  test("tags generic page routes with Cache-Control and html-pages Surrogate-Key", () => {
    const response = proxy(makeRequest("/about"))
    expect(response.headers.get("Surrogate-Key")).toBe("html-pages")
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=")
  })

  test("appends per-item surrogate key for MITxOnline course pages", () => {
    const response = proxy(makeRequest("/courses/course-v1:MITxT+5.601x"))
    expect(response.headers.get("Surrogate-Key")).toBe(
      "html-pages mitxonline:course:course-v1:MITxT+5.601x",
    )
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=")
  })

  test("appends per-item surrogate key for MITxOnline program pages", () => {
    const response = proxy(makeRequest("/programs/program-v1:MITxT+18.01x"))
    expect(response.headers.get("Surrogate-Key")).toBe(
      "html-pages mitxonline:program:program-v1:MITxT+18.01x",
    )
  })

  test("leaves non-page routes untagged", () => {
    const response = proxy(makeRequest("/healthcheck"))
    expect(response.headers.get("Surrogate-Key")).toBeNull()
    expect(response.headers.get("Cache-Control")).toBeNull()
  })

  test("does not throw on CRLF in course path and falls back to html-pages only", () => {
    // Regression: without safeDecodeSegment, Headers.set() would throw TypeError
    // when the decoded segment contains \r\n (%0D%0A).
    expect(() =>
      proxy(makeRequest("/courses/foo%0D%0AX-Injected%3A+yes")),
    ).not.toThrow()
    const response = proxy(makeRequest("/courses/foo%0D%0AX-Injected%3A+yes"))
    expect(response.headers.get("Surrogate-Key")).toBe("html-pages")
  })
})
