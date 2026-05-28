import { useAddToBasket, useClearBasket } from "api/mitxonline-hooks/baskets"

const cartUrl = () =>
  new URL(
    "/cart/?ecom-service=true",
    process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL,
  ).toString()

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
