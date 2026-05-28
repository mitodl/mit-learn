import { useAddToBasket, useClearBasket } from "api/mitxonline-hooks/baskets"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"

const cartUrl = () => mitxonlineLegacyUrl("/cart/")

const useReplaceBasketItem = () => {
  const addToBasket = useAddToBasket()
  const clearBasket = useClearBasket()

  const redirect = () => window.location.assign(cartUrl())

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
    await addToBasket.mutateAsync(productId)
    redirect()
  }

  return {
    mutate,
    mutateAsync,
    isPending: clearBasket.isPending || addToBasket.isPending,
    isError: clearBasket.isError || addToBasket.isError,
  }
}

export { useReplaceBasketItem }
