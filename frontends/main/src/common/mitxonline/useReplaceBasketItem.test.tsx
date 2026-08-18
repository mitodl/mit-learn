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
    expect(assign).toHaveBeenCalledWith(mitxonlineLegacyUrl("/cart/"))
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
    expect(assign).toHaveBeenCalledWith(mitxonlineLegacyUrl("/cart/"))
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
