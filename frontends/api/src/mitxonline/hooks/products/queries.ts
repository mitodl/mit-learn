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
      // Not cacheable like the rest of the app's content. The browser client
      // defaults staleTime to the CDN TTL, which getQueryClient justifies with
      // "most content is stable for ~24 hours (ETL cadence)" — true of a
      // course, false of one learner's price. A program-child-purchase credit
      // appears the moment they buy a child course, and their aid tier can be
      // approved between two page views. Nothing invalidates productsKeys, so
      // without this a stale quote is served until the window elapses.
      // baskets/queries.ts and useComplianceGate do the same for the same
      // reason.
      staleTime: 0,
    }),
}

export { productsKeys, productQueries }
