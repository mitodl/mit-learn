import { renderHook, waitFor } from "@testing-library/react"
import { useConsumeInitialSearchParams } from "./useConsumeInitialSearchParams"

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}))

jest.mock("next-nprogress-bar", () => ({
  useRouter: jest.fn(),
}))

const { useSearchParams } = jest.requireMock("next/navigation")
const { useRouter } = jest.requireMock("next-nprogress-bar")

const mockReplace = jest.fn()

describe("useConsumeInitialSearchParams", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useRouter.mockReturnValue({ replace: mockReplace })
    // jsdom sets window.location.pathname to "/"
  })

  test("returns null and does not call replace when none of the params are present", () => {
    useSearchParams.mockReturnValue(new URLSearchParams(""))

    const { result } = renderHook(() =>
      useConsumeInitialSearchParams(["foo", "bar"]),
    )

    expect(result.current).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  test("reads matching params into state and clears them from the URL", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=hello&bar=world"))

    const { result } = renderHook(() =>
      useConsumeInitialSearchParams(["foo", "bar"]),
    )

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "hello", bar: "world" })
    })
    expect(mockReplace).toHaveBeenCalledWith("/")
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
    expect(mockReplace).toHaveBeenCalledWith("/?unrelated=keep")
  })

  test("preserves hash fragment when cleaning params", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=1"))
    window.location.hash = "#section"

    const { result } = renderHook(() => useConsumeInitialSearchParams(["foo"]))

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "1" })
    })
    expect(mockReplace).toHaveBeenCalledWith("/#section")

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
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
