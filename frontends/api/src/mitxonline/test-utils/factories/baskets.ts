import { faker } from "@faker-js/faker/locale/en"
import invariant from "tiny-invariant"
import type { BasketWithProduct } from "@mitodl/mitxonline-api-axios/v2"

const isSet = (value: unknown) => value !== null && value !== undefined

/**
 * A basket owned by a signed-in user. See `anonymousBasket` for the other case:
 * `user` and `anonymous_id` are mutually exclusive, and MITx Online enforces
 * that with a database constraint (`basket_user_xor_anonymous_id`).
 */
const basket = (
  overrides: Partial<BasketWithProduct> = {},
): BasketWithProduct => {
  const merged: BasketWithProduct = {
    id: faker.number.int({ min: 1 }),
    user: faker.number.int({ min: 1 }),
    anonymous_id: null,
    basket_items: [],
    total_price: 0,
    discounted_price: 0,
    discounts: [],
    ...overrides,
  }
  invariant(
    isSet(merged.user) !== isSet(merged.anonymous_id),
    "A basket has exactly one of `user` and `anonymous_id`. Use basket() for a signed-in user, anonymousBasket() otherwise.",
  )
  return merged
}

/**
 * A basket built before the learner signed in. `anonymous_id` is a real UUID:
 * MITx Online's handoff middleware parses it with `uuid.UUID()` and
 * logs-and-ignores anything that doesn't.
 */
const anonymousBasket = (
  overrides: Partial<BasketWithProduct> = {},
): BasketWithProduct =>
  basket({ user: null, anonymous_id: faker.string.uuid(), ...overrides })

export { basket, anonymousBasket }
