import { useAddToBasket, useClearBasket } from "api/mitxonline-hooks/baskets"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
import type { BasketWithProduct } from "@mitodl/mitxonline-api-axios/v2"

// Django's session cookie (which carries an anonymous basket's id) is
// host-only and can't be widened to a shared mit.edu-scoped cookie - too
// many departments doing that already causes "cookie too big" errors
// institution-wide. So the id is handed off explicitly through the redirect
// URL instead of relying on the browser to carry a cross-domain cookie from
// this (Learn-proxied) API call to mitxonline's own /cart/ page.
const cartUrl = (anonymousBasketId?: string | null) => {
  const url = new URL(mitxonlineLegacyUrl("/cart/"))
  if (anonymousBasketId) {
    url.searchParams.set("anonymous_basket_id", anonymousBasketId)
  }
  return url.toString()
}

const useReplaceBasketItem = () => {
  const addToBasket = useAddToBasket()
  const clearBasket = useClearBasket()

  const redirect = (basket?: BasketWithProduct) =>
    window.location.assign(cartUrl(basket?.anonymous_id))

  const mutate = (productId: number) => {
    addToBasket.reset()
    clearBasket.mutate(undefined, {
      onSuccess: () =>
        addToBasket.mutate(productId, {
          onSuccess: redirect,
        }),
    })
  }

  const mutateAsync = async (productId: number) => {
    addToBasket.reset()
    await clearBasket.mutateAsync()
    const basket = await addToBasket.mutateAsync(productId)
    redirect(basket)
  }

  return {
    mutate,
    mutateAsync,
    isPending: clearBasket.isPending || addToBasket.isPending,
    isError: clearBasket.isError || addToBasket.isError,
  }
}

export { useReplaceBasketItem }
