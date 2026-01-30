import { queryOptions } from "@tanstack/react-query"
import type { CheckoutPayload } from "@mitodl/mitxonline-api-axios/v2"

import { basketsApi } from "../../clients"

const basketKeys = {
  root: ["mitxonline", "baskets"],
  checkout: () => [...basketKeys.root, "checkout"],
}

const basketQueries = {
  checkout: () =>
    queryOptions({
      queryKey: basketKeys.checkout(),
      queryFn: async (): Promise<CheckoutPayload> => {
        const response = await basketsApi.basketsCheckoutRetrieve()
        return response.data
      },
      // Don't cache checkout data - always fetch fresh
      staleTime: 0,
      gcTime: 0,
    }),
}

export { basketKeys, basketQueries }
