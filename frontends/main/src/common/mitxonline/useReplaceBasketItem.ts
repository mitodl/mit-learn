import { useAddToBasket, useClearBasket } from "api/mitxonline-hooks/baskets"
import type { MutationHookOptions } from "api/mutation-meta"
import type { BasketWithProduct } from "@mitodl/mitxonline-api-axios/v2"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
import { useComplianceGate } from "./useComplianceGate"

/**
 * MITxOnline's cart is reached through its session-reset endpoint rather than
 * directly (hq#12763). Learn and MITxOnline keep separate APISIX gateway
 * sessions on separate parent domains, so a browser that switched users on
 * Learn can still be carrying the previous user's MITxOnline session - long
 * enough to be shown, and to check out with, someone else's cart. The bounce
 * discards that session so the cart page authenticates as the current user.
 *
 * `basket_id` names the basket we just filled, over an API call made on Learn's
 * own domain where the session is known to be right. MITxOnline compares it
 * against the basket its session actually owns and bounces back through the
 * reset if they disagree, so the hand-off fails safe even if the reset above
 * does not take.
 */
const cartUrl = (basketId: number) =>
  mitxonlineLegacyUrl(`/switch-session/?next=/cart/&basket_id=${basketId}`)

/**
 * Replaces the basket's contents with a single product and sends the user to
 * checkout.
 *
 * This is the one path every paid enrollment takes, so the compliance gate
 * lives here: a new checkout entry point cannot skip it. If the user dismisses
 * the gate, nothing is added and no redirect happens — callers see a resolved
 * promise with no navigation, so a cancel never reads as a failure.
 */
const useReplaceBasketItem = (opts: MutationHookOptions = {}) => {
  const addToBasket = useAddToBasket(opts)
  const clearBasket = useClearBasket(opts)
  const { ensureCompliance } = useComplianceGate()

  const redirect = (basket: BasketWithProduct) =>
    window.location.assign(cartUrl(basket.id))

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
