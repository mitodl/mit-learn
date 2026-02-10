import { mergeOverrides } from "ol-test-utilities"
import type { PartialFactory } from "ol-test-utilities"
import type {
  ProductFlexiblePrice,
  V0Discount,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  DiscountTypeEnum,
  RedemptionTypeEnum,
} from "@mitodl/mitxonline-api-axios/v2"
import { faker } from "@faker-js/faker/locale/en"
import { UniqueEnforcer } from "enforce-unique"

const uniqueDiscountId = new UniqueEnforcer()

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
    payment_type: null,
    is_redeemed: faker.datatype.boolean(),
    activation_date: faker.date.past().toISOString(),
    expiration_date: faker.date.future().toISOString(),
  }
  return mergeOverrides<V0Discount>(defaults, overrides)
}

const flexiblePrice: PartialFactory<ProductFlexiblePrice> = (
  overrides = {},
) => {
  const defaults: ProductFlexiblePrice = {
    id: faker.number.int(),
    price: faker.commerce.price(),
    description: faker.lorem.sentence(),
    is_active: faker.datatype.boolean(),
    product_flexible_price: discount(),
  }
  return mergeOverrides<ProductFlexiblePrice>(defaults, overrides)
}

export { discount, flexiblePrice }
