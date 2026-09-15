import { queryOptions } from "@tanstack/react-query"
import { productsApi } from "../../clients"

const productsKeys = {
  root: ["mitxonline", "products"],
  userPricing: (opts: { productId: number }) => [
    ...productsKeys.root,
    "product",
    opts,
    "userPricing",
  ],
}

const productQueries = {
  /**
   * What checkout charges this user for this product, plus the discount that
   * gets them there.
   *
   * Rejects anonymous requests. A caller a visitor can reach — a public product
   * page — gates on authentication to avoid firing a request certain to fail.
   * Behind an authenticated route that gate buys nothing: a disabled query and
   * a 401 under `throwOnError: false` both leave `data` undefined, so the
   * caller falls back to the list price either way. What every caller does owe
   * is that fallback.
   */
  userPricingDetail: (opts: { productId: number }) =>
    queryOptions({
      queryKey: productsKeys.userPricing(opts),
      queryFn: () =>
        productsApi
          .productsUserPricingRetrieve({ id: opts.productId })
          .then((r) => r.data),
    }),
}

export { productsKeys, productQueries }
