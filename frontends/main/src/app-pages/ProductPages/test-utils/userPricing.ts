import type {
  UserPricingProduct,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { urls, factories } from "api/mitxonline-test-utils"
import { setMockResponse } from "@/test-utils"

/**
 * Quote every purchasable product on a program. Defaults to list price with no
 * discount, which is the no-change case; pass `quote` to give the learner a
 * discount, an approved flexible price, or a different price to pay.
 */
const setupUserPricing = (
  program: V2ProgramDetail,
  quote: Partial<UserPricingProduct> = {},
): void => {
  program.products.forEach((product) =>
    setMockResponse.get(
      urls.products.userPricingDetail(product.id),
      factories.products.userPricing({
        id: product.id,
        price: product.price,
        ...quote,
      }),
    ),
  )
}

/**
 * A program, with a list-price quote registered for each of its products. The
 * certificate card quotes every signed-in learner, so a program built without
 * one fails any test that renders it authenticated.
 */
const makeProgram: typeof factories.programs.program = (overrides) => {
  const program = factories.programs.program(overrides)
  setupUserPricing(program)
  return program
}

export { makeProgram, setupUserPricing }
