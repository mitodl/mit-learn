import { basketQueries } from "./queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { basketsApi } from "../../clients"
import type { BasketWithProduct } from "@mitodl/mitxonline-api-axios/v2"

/**
 * Hook to add a product to the user's basket.
 * Creates or updates the basket, adding the specified product.
 * On success, automatically redirects to the MITx Online cart page.
 */
const useAddToBasket = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (productId: number): Promise<BasketWithProduct> => {
      const response = await basketsApi.basketsCreateFromProductCreate({
        product_id: productId,
      })
      return response.data
    },
    onSuccess: async () => {
      // Invalidate checkout query to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: basketQueries.basketState().queryKey,
      })

      // Redirect to MITx Online cart page
      // This should happen in useMutation because call-level onSuccess handlers
      // are not guaranteed to run if component unmounts before mutation finishes
      const cartUrl = new URL(
        "/cart/",
        process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL,
      ).toString()
      window.location.assign(cartUrl)
    },
  })
}

/**
 * Hook to clear the user's basket.
 */
const useClearBasket = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await basketsApi.basketsClearDestroy()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: basketQueries.basketState().queryKey,
      })
    },
  })
}

/**
 * Hook to replace the basket with a single product, then redirect to cart.
 *
 * This clears the basket before adding the new item because our cart UI does
 * not currently allow users to remove items. Having more than one item in the
 * basket puts users in a bad UI state. Once the cart supports item removal,
 * this hook should be replaced with a direct call to `useAddToBasket`.
 */
const useReplaceBasketItem = () => {
  const addToBasket = useAddToBasket()
  const clearBasket = useClearBasket()

  const mutate = async (productId: number) => {
    await clearBasket.mutateAsync()
    await addToBasket.mutateAsync(productId)
  }

  return {
    mutate,
    isPending: clearBasket.isPending || addToBasket.isPending,
    isError: clearBasket.isError || addToBasket.isError,
    reset: () => {
      clearBasket.reset()
      addToBasket.reset()
    },
  }
}

export { basketQueries, useAddToBasket, useClearBasket, useReplaceBasketItem }
