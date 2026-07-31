import { act, renderHook, setupLocationMock } from "@/test-utils"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
import { useReplaceBasketItem } from "./useReplaceBasketItem"

const reset = jest.fn()
const mutate = jest.fn(
  (_productId: number, opts?: { onSuccess?: () => void }) =>
    opts?.onSuccess?.(),
)
const mutateAsync = jest.fn().mockResolvedValue({ id: 7 })
const clearMutate = jest.fn(
  (_vars: undefined, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.(),
)
const clearMutateAsync = jest.fn().mockResolvedValue(undefined)

jest.mock("api/mitxonline-hooks/baskets", () => ({
  useAddToBasket: () => ({
    mutate,
    mutateAsync,
    reset,
    isPending: false,
    isError: false,
  }),
  useClearBasket: () => ({
    mutate: clearMutate,
    mutateAsync: clearMutateAsync,
    isPending: false,
    isError: false,
  }),
}))

describe("useReplaceBasketItem", () => {
  setupLocationMock()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("redirects after the sync mutate path succeeds", () => {
    const assign = jest.mocked(window.location.assign)
    const { result } = renderHook(() => useReplaceBasketItem())

    act(() => {
      result.current.mutate(42)
    })

    expect(reset).toHaveBeenCalled()
    expect(clearMutate).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    expect(mutate).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    expect(assign).toHaveBeenCalledWith(mitxonlineLegacyUrl("/cart/"))
  })

  test("redirects after the async mutateAsync path succeeds", async () => {
    const assign = jest.mocked(window.location.assign)
    const { result } = renderHook(() => useReplaceBasketItem())

    await act(async () => {
      await result.current.mutateAsync(42)
    })

    expect(reset).toHaveBeenCalled()
    expect(clearMutateAsync).toHaveBeenCalled()
    expect(mutateAsync).toHaveBeenCalledWith(42)
    expect(assign).toHaveBeenCalledWith(mitxonlineLegacyUrl("/cart/"))
  })

  test("does not add or redirect when the sync clear never succeeds", () => {
    const assign = jest.mocked(window.location.assign)
    // Simulate clear failing: its onSuccess is never invoked. This also pins the
    // ordering — add must be nested inside clear's onSuccess, not fired directly.
    clearMutate.mockImplementationOnce(() => {})
    const { result } = renderHook(() => useReplaceBasketItem())

    act(() => {
      result.current.mutate(42)
    })

    expect(clearMutate).toHaveBeenCalled()
    expect(mutate).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })

  test("does not add or redirect when the async clear rejects", async () => {
    const assign = jest.mocked(window.location.assign)
    clearMutateAsync.mockRejectedValueOnce(new Error("clear failed"))
    const { result } = renderHook(() => useReplaceBasketItem())

    await act(async () => {
      await expect(result.current.mutateAsync(42)).rejects.toThrow(
        "clear failed",
      )
    })

    expect(mutateAsync).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })

  test("appends anonymous_basket_id to the redirect url for an anonymous basket (sync path)", () => {
    const assign = jest.mocked(window.location.assign)
    mutate.mockImplementationOnce(
      (_productId: number, opts?: { onSuccess?: (b: unknown) => void }) =>
        opts?.onSuccess?.({ id: 9, anonymous_id: "abc-123" }),
    )
    const { result } = renderHook(() => useReplaceBasketItem())

    act(() => {
      result.current.mutate(42)
    })

    const calledUrl = new URL(assign.mock.calls[0][0])
    expect(calledUrl.searchParams.get("anonymous_basket_id")).toBe("abc-123")
  })

  test("appends anonymous_basket_id to the redirect url for an anonymous basket (async path)", async () => {
    const assign = jest.mocked(window.location.assign)
    mutateAsync.mockResolvedValueOnce({ id: 9, anonymous_id: "abc-123" })
    const { result } = renderHook(() => useReplaceBasketItem())

    await act(async () => {
      await result.current.mutateAsync(42)
    })

    const calledUrl = new URL(assign.mock.calls[0][0])
    expect(calledUrl.searchParams.get("anonymous_basket_id")).toBe("abc-123")
  })

  test("does not append anonymous_basket_id when the basket belongs to a real user", () => {
    const assign = jest.mocked(window.location.assign)
    mutate.mockImplementationOnce(
      (_productId: number, opts?: { onSuccess?: (b: unknown) => void }) =>
        opts?.onSuccess?.({ id: 9, user: 1, anonymous_id: null }),
    )
    const { result } = renderHook(() => useReplaceBasketItem())

    act(() => {
      result.current.mutate(42)
    })

    const calledUrl = new URL(assign.mock.calls[0][0])
    expect(calledUrl.searchParams.has("anonymous_basket_id")).toBe(false)
  })
})
