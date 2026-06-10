import { renderHook } from "@testing-library/react"
import { useCanonicalizeResourceParam } from "./useCanonicalizeResourceParam"

const setUrl = (search: string) => {
  window.history.replaceState({}, "", `/search${search}`)
}

describe("useCanonicalizeResourceParam", () => {
  let spy: jest.SpyInstance
  beforeEach(() => {
    spy = jest.spyOn(window.history, "replaceState")
  })
  afterEach(() => spy.mockRestore())

  test("adds resource_title to a bare ?resource=, preserving other params and resource", () => {
    setUrl("?resource=114927&syllabus=")
    spy.mockClear()
    renderHook(() => useCanonicalizeResourceParam(114927, "Beyond Biology"))
    expect(spy).toHaveBeenCalledTimes(1)
    const url = spy.mock.calls[0][2] as string
    expect(url).toContain("resource=114927")
    expect(url).toContain("resource_title=beyond-biology")
    expect(url).toContain("syllabus=")
    expect(url.startsWith("/search?")).toBe(true)
  })

  test("corrects a stale resource_title", () => {
    setUrl("?resource=114927&resource_title=old-title")
    spy.mockClear()
    renderHook(() => useCanonicalizeResourceParam(114927, "Beyond Biology"))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][2]).toContain("resource_title=beyond-biology")
  })

  test("removes resource_title when the slug is blank", () => {
    setUrl("?resource=114927&resource_title=old-title")
    spy.mockClear()
    renderHook(() => useCanonicalizeResourceParam(114927, "2024"))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][2]).not.toContain("resource_title")
    expect(spy.mock.calls[0][2]).toContain("resource=114927")
  })

  test("does not rewrite when resource_title is already canonical", () => {
    setUrl("?resource=114927&resource_title=beyond-biology")
    spy.mockClear()
    renderHook(() => useCanonicalizeResourceParam(114927, "Beyond Biology"))
    expect(spy).not.toHaveBeenCalled()
  })

  test("does not rewrite when slug is blank and no resource_title present", () => {
    setUrl("?resource=114927")
    spy.mockClear()
    renderHook(() => useCanonicalizeResourceParam(114927, "2024"))
    expect(spy).not.toHaveBeenCalled()
  })

  test("does not write resource_title when the resource has left the URL", () => {
    // e.g. drawer closed (params removed) before the detail fetch resolved
    setUrl("?syllabus=")
    spy.mockClear()
    renderHook(() => useCanonicalizeResourceParam(114927, "Beyond Biology"))
    expect(spy).not.toHaveBeenCalled()
  })

  test("does nothing until the resource (title) is known", () => {
    setUrl("?resource=114927")
    spy.mockClear()
    renderHook(() => useCanonicalizeResourceParam(undefined, undefined))
    expect(spy).not.toHaveBeenCalled()
  })

  test("does not re-run when inputs are unchanged across re-renders", () => {
    setUrl("?resource=114927&resource_title=beyond-biology")
    const { rerender } = renderHook(
      ({ id, title }) => useCanonicalizeResourceParam(id, title),
      { initialProps: { id: 114927, title: "Beyond Biology" } },
    )
    spy.mockClear()
    rerender({ id: 114927, title: "Beyond Biology" })
    expect(spy).not.toHaveBeenCalled()
  })
})
