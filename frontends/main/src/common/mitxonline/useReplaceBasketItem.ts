import { useAddToBasket, useClearBasket } from "api/mitxonline-hooks/baskets"
import type { MutationHookOptions } from "api/mutation-meta"
import type { EnrollmentTarget } from "api/mitxonline-hooks/enrollment"
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
 *
 * Given the `target` the product is for, the gate also runs the real export
 * compliance check (`ensureEligibility`), so profile data CyberSource rejects
 * is fixed here rather than discovered at checkout.
 */
const useReplaceBasketItem = (opts: MutationHookOptions = {}) => {
  const addToBasket = useAddToBasket(opts)
  const clearBasket = useClearBasket(opts)
  const { ensureCompliance, ensureEligibility } = useComplianceGate()
  const gate = (target?: EnrollmentTarget) =>
    target ? ensureEligibility(target) : ensureCompliance()

  const redirect = () => window.location.assign(cartUrl())

  // Returns void, like the `useMutation` mutate it stands in for, so call sites
  // stay fire-and-forget and don't acquire a promise to handle.
  const mutate = (productId: number, target?: EnrollmentTarget) => {
    void gate(target).then((allowed) => {
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

  const mutateAsync = async (productId: number, target?: EnrollmentTarget) => {
    if (!(await gate(target))) return
    addToBasket.reset()
    await clearBasket.mutateAsync()
    await addToBasket.mutateAsync(productId)
    redirect()
  }

  return {
    mutate,
    mutateAsync,
    isPending: clearBasket.isPending || addToBasket.isPending,
    // The error itself, not a boolean, so call sites can prefer a 400 `detail`.
    // `addToBasket` wins: its 400 carries the product-specific explanation.
    error: addToBasket.error ?? clearBasket.error,
  }
}

export { useReplaceBasketItem }
