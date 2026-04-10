import { renderHook, waitFor } from "@testing-library/react"
import { useConsumeSearchParamsOnce } from "./useConsumeSearchParamsOnce"

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}))

const { useSearchParams } = jest.requireMock("next/navigation")

let replaceStateSpy: jest.SpyInstance

describe("useConsumeSearchParamsOnce", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    replaceStateSpy = jest.spyOn(window.history, "replaceState")
    // jsdom sets window.location.pathname to "/"
  })

  afterEach(() => {
    replaceStateSpy.mockRestore()
  })

  test("returns undefined and does not modify the URL when the parser does not match", () => {
    useSearchParams.mockReturnValue(new URLSearchParams(""))

    const { result } = renderHook(() => useConsumeSearchParamsOnce(() => null))

    expect(result.current).toBeUndefined()
    expect(replaceStateSpy).not.toHaveBeenCalled()
  })

  test("stores the parsed value and clears only the requested params", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=hello&bar=world"))

    const { result } = renderHook(() =>
      useConsumeSearchParamsOnce((searchParams) => ({
        value: {
          foo: searchParams.get("foo"),
          bar: searchParams.get("bar"),
        },
        keysToRemove: ["foo", "bar"],
      })),
    )

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "hello", bar: "world" })
    })
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/")
  })

  test("allows the parser to keep missing values in the returned payload", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=yes"))

    const { result } = renderHook(() =>
      useConsumeSearchParamsOnce((searchParams) => ({
        value: {
          foo: searchParams.get("foo"),
          bar: searchParams.get("bar"),
        },
        keysToRemove: ["foo"],
      })),
    )

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "yes", bar: null })
    })
  })

  test("preserves unrelated query params when cleaning", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=1&unrelated=keep"))

    const { result } = renderHook(() =>
      useConsumeSearchParamsOnce((searchParams) => ({
        value: { foo: searchParams.get("foo") },
        keysToRemove: ["foo"],
      })),
    )

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "1" })
    })
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/?unrelated=keep")
  })

  test("preserves hash fragment when cleaning params", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=1"))
    window.location.hash = "#section"

    const { result } = renderHook(() =>
      useConsumeSearchParamsOnce((searchParams) => ({
        value: { foo: searchParams.get("foo") },
        keysToRemove: ["foo"],
      })),
    )

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "1" })
    })
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/#section")

    window.location.hash = ""
  })

  test("supports cleanup-only results by allowing value to be undefined", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=1&unrelated=keep"))

    const { result } = renderHook(() =>
      useConsumeSearchParamsOnce(() => ({
        value: undefined,
        keysToRemove: ["foo"],
      })),
    )

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/?unrelated=keep")
    })
    expect(result.current).toBeUndefined()
  })

  test("does not consume params that appear after first render", async () => {
    // First render: no matching params
    useSearchParams.mockReturnValue(new URLSearchParams(""))

    const { result, rerender } = renderHook(() =>
      useConsumeSearchParamsOnce((searchParams) => {
        if (!searchParams.has("foo")) {
          return null
        }
        return {
          value: { foo: searchParams.get("foo") },
          keysToRemove: ["foo"],
        }
      }),
    )

    expect(result.current).toBeUndefined()

    // Later: params appear (e.g., client-side navigation)
    useSearchParams.mockReturnValue(new URLSearchParams("foo=late"))
    rerender()

    // Should still be undefined — hook only reads initial params
    expect(result.current).toBeUndefined()
    expect(replaceStateSpy).not.toHaveBeenCalled()
  })
})
