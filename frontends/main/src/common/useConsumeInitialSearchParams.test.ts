import { renderHook, waitFor } from "@testing-library/react"
import { useConsumeInitialSearchParams } from "./useConsumeInitialSearchParams"

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}))

const { useSearchParams } = jest.requireMock("next/navigation")

let replaceStateSpy: jest.SpyInstance

describe("useConsumeInitialSearchParams", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    replaceStateSpy = jest.spyOn(window.history, "replaceState")
    // jsdom sets window.location.pathname to "/"
  })

  afterEach(() => {
    replaceStateSpy.mockRestore()
  })

  test("returns null and does not modify the URL when none of the params are present", () => {
    useSearchParams.mockReturnValue(new URLSearchParams(""))

    const { result } = renderHook(() =>
      useConsumeInitialSearchParams(["foo", "bar"]),
    )

    expect(result.current).toBeNull()
    expect(replaceStateSpy).not.toHaveBeenCalled()
  })

  test("reads matching params into state and clears them from the URL", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=hello&bar=world"))

    const { result } = renderHook(() =>
      useConsumeInitialSearchParams(["foo", "bar"]),
    )

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "hello", bar: "world" })
    })
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/")
  })

  test("returns null for params in the list that are not in the URL", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=yes"))

    const { result } = renderHook(() =>
      useConsumeInitialSearchParams(["foo", "bar"]),
    )

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "yes", bar: null })
    })
  })

  test("preserves unrelated query params when cleaning", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=1&unrelated=keep"))

    const { result } = renderHook(() => useConsumeInitialSearchParams(["foo"]))

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "1" })
    })
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/?unrelated=keep")
  })

  test("preserves hash fragment when cleaning params", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=1"))
    window.location.hash = "#section"

    const { result } = renderHook(() => useConsumeInitialSearchParams(["foo"]))

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "1" })
    })
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/#section")

    window.location.hash = ""
  })

  test("does not consume params that appear after first render", async () => {
    // First render: no matching params
    useSearchParams.mockReturnValue(new URLSearchParams(""))

    const { result, rerender } = renderHook(() =>
      useConsumeInitialSearchParams(["foo"]),
    )

    expect(result.current).toBeNull()

    // Later: params appear (e.g., client-side navigation)
    useSearchParams.mockReturnValue(new URLSearchParams("foo=late"))
    rerender()

    // Should still be null — hook only reads initial params
    expect(result.current).toBeNull()
    expect(replaceStateSpy).not.toHaveBeenCalled()
  })
})
