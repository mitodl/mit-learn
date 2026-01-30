import { basketQueries } from "./queries"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { basketsApi } from "../../clients"
import type { BasketWithProduct } from "@mitodl/mitxonline-api-axios/v2"

/**
 * Hook to add a product to the user's basket.
 * Creates or updates the basket, adding the specified product.
 * On success, automatically redirects to the checkout page.
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
        queryKey: basketQueries.checkout().queryKey,
      })

      // Get checkout data and submit form to CyberSource
      try {
        const checkoutResponse = await basketsApi.basketsCheckoutRetrieve()
        const { url, payload } = checkoutResponse.data

        if (url && payload) {
          // Create a form and submit it to CyberSource
          const form = document.createElement("form")
          form.method = "POST"
          form.action = url

          // Add all payload fields as hidden inputs
          Object.entries(payload).forEach(([key, value]) => {
            const input = document.createElement("input")
            input.type = "hidden"
            input.name = key
            input.value = String(value)
            form.appendChild(input)
          })

          document.body.appendChild(form)
          form.submit()
        }
      } catch (error) {
        console.error("Failed to get checkout URL:", error)
      }
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
        queryKey: basketQueries.checkout().queryKey,
      })
    },
  })
}

export { basketQueries, useAddToBasket, useClearBasket }
