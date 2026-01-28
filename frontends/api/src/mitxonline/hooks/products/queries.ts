import { queryOptions } from "@tanstack/react-query"
import { productsApi } from "../../clients"

const productsKeys = {
  root: ["mitxonline", "products"],
  userFlexiblePrice: (opts: { productId: number }) => [
    ...productsKeys.root,
    "product",
    opts,
    "flexibleDetail",
  ],
}

const productQueries = {
  userFlexiblePriceDetail: (opts: { productId: number }) =>
    queryOptions({
      queryKey: productsKeys.userFlexiblePrice(opts),
      queryFn: () =>
        productsApi
          .productsUserFlexiblePriceRetrieve({ id: opts.productId })
          .then((r) => r.data),
    }),
}

export { productsKeys, productQueries }
