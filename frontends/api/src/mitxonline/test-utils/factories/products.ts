import { mergeOverrides } from "ol-test-utilities"
import type { PartialFactory } from "ol-test-utilities"
import type {
  DiscountSource,
  UserPricingDiscount,
  UserPricingProduct,
  V0Discount,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  DiscountSourceTypeEnum,
  DiscountTypeEnum,
  RedemptionTypeEnum,
} from "@mitodl/mitxonline-api-axios/v2"
import { faker } from "@faker-js/faker/locale/en"
import { UniqueEnforcer } from "enforce-unique"

const uniqueDiscountId = new UniqueEnforcer()

/**
 * A learner's approved financial-assistance discount, as it appears in
 * `user_pricing`'s `product_flexible_price` field, which says whether aid is
 * approved and at which tier even when another discount wins the quote.
 *
 * `paid-amount-off` is excluded: that type carries a stored amount of zero and
 * a per-learner resolved value, so it is never a flexible price.
 */
const discount: PartialFactory<V0Discount> = (overrides = {}) => {
  const defaults: V0Discount = {
    id: uniqueDiscountId.enforce(() => faker.number.int()),
    amount: faker.commerce.price({ min: 10, max: 100 }),
    automatic: faker.datatype.boolean(),
    discount_type: faker.helpers.arrayElement([
      DiscountTypeEnum.PercentOff,
      DiscountTypeEnum.DollarsOff,
      DiscountTypeEnum.FixedPrice,
    ]),
    redemption_type: faker.helpers.arrayElement([
      RedemptionTypeEnum.OneTime,
      RedemptionTypeEnum.OneTimePerUser,
      RedemptionTypeEnum.Unlimited,
    ]),
    max_redemptions: faker.number.int({ min: 1, max: 100 }),
    discount_code: faker.string.alphanumeric(8).toUpperCase(),
    is_redeemed: faker.datatype.boolean(),
    activation_date: faker.date.past().toISOString(),
    expiration_date: faker.date.future().toISOString(),
  }
  return mergeOverrides<V0Discount>(defaults, overrides)
}

/** The prior purchase a paid-amount-off credit spends. */
const discountSource: PartialFactory<DiscountSource> = (overrides = {}) => {
  const defaults: DiscountSource = {
    type: DiscountSourceTypeEnum.Course,
    readable_id: `course-v1:MITx+${faker.string.alphanumeric(6)}`,
    title: faker.company.catchPhrase(),
  }
  return mergeOverrides<DiscountSource>(defaults, overrides)
}

/**
 * The discount checkout would apply. Defaults to the program-child purchase
 * credit, the only type that names a source; pass `discount_type` and
 * `source: null` for any other kind, and `payment_type` to make it the
 * learner's financial-assistance tier. `payment_type` is left off by default:
 * a discount created without one reports null, which the generated type spells
 * as absent.
 */
const userPricingDiscount: PartialFactory<UserPricingDiscount> = (
  overrides = {},
) => {
  const defaults: UserPricingDiscount = {
    id: uniqueDiscountId.enforce(() => faker.number.int()),
    discount_code: faker.string.alphanumeric(8).toUpperCase(),
    discount_type: DiscountTypeEnum.PaidAmountOff,
    amount_off: faker.commerce.price({ min: 10, max: 100 }),
    source: discountSource(),
  }
  return mergeOverrides<UserPricingDiscount>(defaults, overrides)
}

/**
 * A product priced for one user. Defaults to list price with no discount and
 * no approved financial assistance, which is what most learners see.
 */
const userPricing: PartialFactory<UserPricingProduct> = (overrides = {}) => {
  // Read the caller's price before building the defaults, so `user_price` is
  // the list-price quote this factory advertises rather than an unrelated
  // figure — which anything rendering `user_price` would show as a discount.
  const price = overrides.price ?? faker.commerce.price()
  const defaults: UserPricingProduct = {
    id: faker.number.int(),
    price,
    description: faker.lorem.sentence(),
    is_active: true,
    product_flexible_price: null,
    user_price: price,
    discount: null,
  }
  return mergeOverrides<UserPricingProduct>(defaults, overrides)
}

export { discount, discountSource, userPricing, userPricingDiscount }
