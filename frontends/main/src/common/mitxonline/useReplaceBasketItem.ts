import { useAddToBasket, useClearBasket } from "api/mitxonline-hooks/baskets"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
import { useComplianceGate } from "./useComplianceGate"

const cartUrl = () => mitxonlineLegacyUrl("/cart/")

/**
 * Replaces the basket's contents with a single product and sends the user to
 * checkout.
 *
 * This is the one path every paid enrollment takes, so the compliance gate
 * lives here: a new checkout entry point cannot skip it. If the user dismisses
 * the gate, nothing is added and no redirect happens — callers see a resolved
 * promise with no navigation, so a cancel never reads as a failure.
 */
const useReplaceBasketItem = () => {
  const addToBasket = useAddToBasket()
  const clearBasket = useClearBasket()
  const { ensureCompliance } = useComplianceGate()

  const redirect = () => window.location.assign(cartUrl())

  // Returns void, like the `useMutation` mutate it stands in for, so call sites
  // stay fire-and-forget and don't acquire a promise to handle.
  const mutate = (productId: number) => {
    void ensureCompliance().then((allowed) => {
      if (!allowed) return
      addToBasket.reset()
      clearBasket.mutate(undefined, {
        onSuccess: () =>
          addToBasket.mutate(productId, {
            onSuccess: redirect,
          }),
      })
    })
  }

  const mutateAsync = async (productId: number) => {
    if (!(await ensureCompliance())) return
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
