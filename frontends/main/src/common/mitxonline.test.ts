import { factories } from "api/mitxonline-test-utils"
import { DiscountTypeEnum } from "@mitodl/mitxonline-api-axios/v2"
import {
  getFlexiblePriceForProduct,
  priceWithDiscount,
} from "@/common/mitxonline"

const makeFlexiblePrice = factories.products.flexiblePrice

describe("getFlexiblePriceForProduct", () => {
  test("Applies dollars-off discount correctly", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "25.00",
        discount_type: DiscountTypeEnum.DollarsOff,
        discount_code: "TEST25",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = getFlexiblePriceForProduct(product)

    expect(result).toBe(75) // $100 - $25
  })

  test("Applies percent-off discount correctly", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "20.00", // 20% off
        discount_type: DiscountTypeEnum.PercentOff,
        discount_code: "TEST20",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = getFlexiblePriceForProduct(product)

    expect(result).toBe(80) // $100 * (1 - 20/100)
  })

  test("Applies fixed-price discount correctly", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "50.00", // Fixed price of $50
        discount_type: DiscountTypeEnum.FixedPrice,
        discount_code: "FIXED50",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = getFlexiblePriceForProduct(product)

    expect(result).toBe(50)
  })

  test("Returns original price when no discount is applied", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: null,
    })

    const result = getFlexiblePriceForProduct(product)

    expect(result).toBe(100)
  })

  test("Returns original price when discount type is unrecognized", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "25.00",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        discount_type: "unknown-type" as any,
        discount_code: "UNKNOWN",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = getFlexiblePriceForProduct(product)

    expect(result).toBe(100)
  })
})

describe("priceWithDiscount", () => {
  test("Returns same price for original and final when no flexible price provided", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: null,
    })

    const result = priceWithDiscount({ product })

    expect(result.originalPrice).toBe("$100.00")
    expect(result.finalPrice).toBe("$100.00")
    expect(result.isDiscounted).toBe(false)
    expect(result.approvedFinancialAid).toBe(false)
  })

  test("Returns discounted price when flexible price is provided", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: null,
    })

    const flexiblePrice = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "30.00",
        discount_type: DiscountTypeEnum.DollarsOff,
        discount_code: "SAVE30",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = priceWithDiscount({ product, flexiblePrice })

    expect(result.originalPrice).toBe("$100.00")
    expect(result.finalPrice).toBe("$70.00")
    expect(result.isDiscounted).toBe(true)
    expect(result.approvedFinancialAid).toBe(true)
  })

  test("Shows no discount when flexible price results in same price", () => {
    const product = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: null,
    })

    // Flexible price with 0% discount
    const flexiblePrice = makeFlexiblePrice({
      price: "100.00",
      product_flexible_price: {
        id: 1,
        amount: "0.00",
        discount_type: DiscountTypeEnum.DollarsOff,
        discount_code: "NODISCOUNT",
        redemption_type: "one-time",
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: new Date().toISOString(),
        expiration_date: new Date().toISOString(),
      },
    })

    const result = priceWithDiscount({ product, flexiblePrice })

    expect(result.originalPrice).toBe("$100.00")
    expect(result.finalPrice).toBe("$100.00")
    expect(result.isDiscounted).toBe(false)
    expect(result.approvedFinancialAid).toBe(true) // Has financial aid approval, just no discount
  })
})
