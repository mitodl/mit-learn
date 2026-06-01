import { NextRequest } from "next/server"
import { middleware } from "./middleware"

const makeRequest = (pathname: string) =>
  new NextRequest(new URL(pathname, "http://test.learn.odl.local:8062"))

describe("middleware — Surrogate-Key headers", () => {
  describe("/courses/:readable_id", () => {
    it("sets mitxonline:course surrogate key", () => {
      const response = middleware(
        makeRequest("/courses/course-v1:MITx+6.00.1x+3T2019"),
      )
      expect(response.headers.get("Surrogate-Key")).toBe(
        "mitxonline:course:course-v1:MITx+6.00.1x+3T2019",
      )
    })

    it("handles URL-encoded readable_id", () => {
      const encoded = encodeURIComponent("course-v1:MITx+6.00.1x+3T2019")
      const response = middleware(makeRequest(`/courses/${encoded}`))
      expect(response.headers.get("Surrogate-Key")).toBe(
        "mitxonline:course:course-v1:MITx+6.00.1x+3T2019",
      )
    })
  })

  describe("/courses/p/:readable_id", () => {
    it("sets mitxonline:course surrogate key (same key as /courses/)", () => {
      const response = middleware(
        makeRequest("/courses/p/course-v1:MITx+6.00.1x+3T2019"),
      )
      expect(response.headers.get("Surrogate-Key")).toBe(
        "mitxonline:course:course-v1:MITx+6.00.1x+3T2019",
      )
    })
  })

  describe("/programs/:readable_id", () => {
    it("sets mitxonline:program surrogate key", () => {
      const response = middleware(makeRequest("/programs/program-v1:MITx+SDS"))
      expect(response.headers.get("Surrogate-Key")).toBe(
        "mitxonline:program:program-v1:MITx+SDS",
      )
    })
  })

  describe("non-product pages", () => {
    it.each(["/", "/search", "/about", "/courses", "/programs"])(
      "does not set Surrogate-Key on %s",
      (pathname) => {
        const response = middleware(makeRequest(pathname))
        expect(response.headers.get("Surrogate-Key")).toBeNull()
      },
    )
  })
})
