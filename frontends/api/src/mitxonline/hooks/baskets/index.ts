import { basketQueries } from "./queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { basketsApi } from "../../clients"
import { useUserIsAuthenticated } from "../../../hooks/user"
import type { BasketWithProduct } from "@mitodl/mitxonline-api-axios/v2"

/**
 * Hook to add a product to the user's basket.
 * Creates or updates the basket, adding the specified product.
 */
const useAddToBasket = () => {
  const queryClient = useQueryClient()
  const isAuthenticated = useUserIsAuthenticated()
  return useMutation({
    mutationFn: async (productId: number): Promise<BasketWithProduct> => {
      const response = await basketsApi.basketsCreateFromProductCreate({
        product_id: productId,
      })
      return response.data
    },
    onSuccess: async () => {
      // Invalidate checkout query to ensure fresh data - but only once
      // authenticated. basketState hits the checkout-payload endpoint, which
      // creates a real order against the basket's purchaser; an anonymous
      // basket has no purchaser, so this has to wait until after the
      // anonymous-checkout conversion step, not fire on every cart add.
      if (isAuthenticated) {
        queryClient.invalidateQueries({
          queryKey: basketQueries.basketState().queryKey,
        })
      }
    },
  })
}

/**
 * Hook to clear the user's basket.
 */
const useClearBasket = () => {
  const queryClient = useQueryClient()
  const isAuthenticated = useUserIsAuthenticated()
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await basketsApi.basketsClearDestroy()
    },
    onSuccess: () => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({
          queryKey: basketQueries.basketState().queryKey,
        })
      }
    },
  })
}

export { basketQueries, useAddToBasket, useClearBasket }
