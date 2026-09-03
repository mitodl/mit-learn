import { act, renderHook, setupLocationMock } from "@/test-utils"
import React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { makeBrowserQueryClient } from "@/app/getQueryClient"
import { setMockResponse } from "api/test-utils"
import * as mitxonline from "api/mitxonline-test-utils"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
import { useReplaceBasketItem } from "./useReplaceBasketItem"

// The compliance gate fetches the MITx Online user through react-query.
const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = makeBrowserQueryClient({ maxRetries: 0 })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const BASKET = { id: 7 }

const reset = jest.fn()
// react-query hands the mutation's result to a per-call onSuccess; the redirect
// reads the basket id off it, so the mock has to pass it through too.
const mutate = jest.fn(
  (
    _productId: number,
    opts?: { onSuccess?: (basket: typeof BASKET) => void },
  ) => opts?.onSuccess?.(BASKET),
)
const mutateAsync = jest.fn().mockResolvedValue(BASKET)
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
    // The compliance gate reads the MITx Online user before touching the
    // basket. A complete profile (the factory default) lets it through.
    setMockResponse.get(
      mitxonline.urls.userMe.get(),
      mitxonline.factories.user.user(),
    )
  })

  test("redirects after the sync mutate path succeeds", async () => {
    const assign = jest.mocked(window.location.assign)
    const { result } = renderHook(() => useReplaceBasketItem(), { wrapper })

    await act(async () => {
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
    expect(assign).toHaveBeenCalledWith(
      mitxonlineLegacyUrl(
        `/switch-session/?next=/cart/&basket_id=${BASKET.id}`,
      ),
    )
  })

  test("routes checkout through MITxOnline's session-reset endpoint", async () => {
    // Pins the cross-app contract rather than mirroring the implementation's
    // string: MITxOnline's /switch-session discards a stale gateway session
    // before the cart renders (hq#12763), and `next` is what it forwards to.
    const assign = jest.mocked(window.location.assign)
    const { result } = renderHook(() => useReplaceBasketItem(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(42)
    })

    const target = new URL(assign.mock.calls[0][0] as string)
    expect(target.pathname).toBe("/switch-session/")
    expect(target.searchParams.get("next")).toBe("/cart/")
    expect(target.searchParams.get("ecom-service")).toBe("true")
    // MITxOnline compares this against the basket its own session owns.
    expect(target.searchParams.get("basket_id")).toBe(String(BASKET.id))
  })

  test("redirects after the async mutateAsync path succeeds", async () => {
    const assign = jest.mocked(window.location.assign)
    const { result } = renderHook(() => useReplaceBasketItem(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(42)
    })

    expect(reset).toHaveBeenCalled()
    expect(clearMutateAsync).toHaveBeenCalled()
    expect(mutateAsync).toHaveBeenCalledWith(42)
    expect(assign).toHaveBeenCalledWith(
      mitxonlineLegacyUrl(
        `/switch-session/?next=/cart/&basket_id=${BASKET.id}`,
      ),
    )
  })

  test("does not add or redirect when the sync clear never succeeds", async () => {
    const assign = jest.mocked(window.location.assign)
    // Simulate clear failing: its onSuccess is never invoked. This also pins the
    // ordering — add must be nested inside clear's onSuccess, not fired directly.
    clearMutate.mockImplementationOnce(() => {})
    const { result } = renderHook(() => useReplaceBasketItem(), { wrapper })

    await act(async () => {
      result.current.mutate(42)
    })

    expect(clearMutate).toHaveBeenCalled()
    expect(mutate).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })

  test("does not add or redirect when the async clear rejects", async () => {
    const assign = jest.mocked(window.location.assign)
    clearMutateAsync.mockRejectedValueOnce(new Error("clear failed"))
    const { result } = renderHook(() => useReplaceBasketItem(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync(42)).rejects.toThrow(
        "clear failed",
      )
    })

    expect(mutateAsync).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })
})
