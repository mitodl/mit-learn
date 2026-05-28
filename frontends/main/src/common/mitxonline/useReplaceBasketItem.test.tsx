import { act, renderHook, setupLocationMock } from "@/test-utils"
import { useReplaceBasketItem } from "./useReplaceBasketItem"

const reset = jest.fn()
const mutate = jest.fn((_productId: number, opts?: { onSuccess?: () => void }) =>
  opts?.onSuccess?.(),
)
const mutateAsync = jest.fn().mockResolvedValue({ id: 7 })
const clearMutate = jest.fn(
  (_vars: undefined, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.(),
)
const clearMutateAsync = jest.fn().mockResolvedValue(undefined)
const originalEnv = process.env

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
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL: "https://mitx.example.edu",
    }
  })

  afterAll(() => {
    process.env = originalEnv
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
    expect(assign).toHaveBeenCalledWith(
      "https://mitx.example.edu/cart/?ecom-service=true",
    )
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
    expect(assign).toHaveBeenCalledWith(
      "https://mitx.example.edu/cart/?ecom-service=true",
    )
  })
})
