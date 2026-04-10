import { renderHook, waitFor } from "@testing-library/react"
import { useConsumeSearchParams } from "./useConsumeSearchParams"

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}))

jest.mock("next-nprogress-bar", () => ({
  useRouter: jest.fn(),
}))

const { useSearchParams } = jest.requireMock("next/navigation")
const { useRouter } = jest.requireMock("next-nprogress-bar")

const mockReplace = jest.fn()

describe("useConsumeSearchParams", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useRouter.mockReturnValue({ replace: mockReplace })
    // jsdom sets window.location.pathname to "/"
  })

  test("returns null and does not call replace when none of the params are present", () => {
    useSearchParams.mockReturnValue(new URLSearchParams(""))

    const { result } = renderHook(() => useConsumeSearchParams(["foo", "bar"]))

    expect(result.current).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  test("reads matching params into state and clears them from the URL", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=hello&bar=world"))

    const { result } = renderHook(() => useConsumeSearchParams(["foo", "bar"]))

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "hello", bar: "world" })
    })
    expect(mockReplace).toHaveBeenCalledWith("/")
  })

  test("returns null for params in the list that are not in the URL", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=yes"))

    const { result } = renderHook(() => useConsumeSearchParams(["foo", "bar"]))

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "yes", bar: null })
    })
  })

  test("preserves unrelated query params when cleaning", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("foo=1&unrelated=keep"))

    const { result } = renderHook(() => useConsumeSearchParams(["foo"]))

    await waitFor(() => {
      expect(result.current).toEqual({ foo: "1" })
    })
    expect(mockReplace).toHaveBeenCalledWith("/?unrelated=keep")
  })
})
