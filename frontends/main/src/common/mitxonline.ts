import type {
  CourseRunV2,
  ProductFlexiblePrice,
} from "@mitodl/mitxonline-api-axios/v2"
import { DiscountTypeEnum } from "@mitodl/mitxonline-api-axios/v2"
import invariant from "tiny-invariant"

const NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL =
  process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL
invariant(NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL)

const upgradeRunUrl = (product: ProductFlexiblePrice): string => {
  try {
    const url = new URL("/cart/add", NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL)
    url.searchParams.append("product_id", String(product.id))
    return url.toString()
  } catch (err) {
    console.error("Error constructing upgrade URL:", err)
    return ""
  }
}

const canUpgradeRun = (run: CourseRunV2): boolean => {
  // Prefer to handle this on backend
  // See https://github.com/mitodl/hq/issues/9450
  return (
    run.is_enrollable &&
    !run.is_archived &&
    run.is_upgradable &&
    Boolean(run.products?.length)
  )
}

export const getFlexiblePriceForProduct = (product: ProductFlexiblePrice) => {
  const flexDiscountAmount = Number(product.product_flexible_price?.amount) ?? 0
  const flexDiscountType = product.product_flexible_price?.discount_type
  const price = Number(product.price)

  switch (flexDiscountType) {
    case DiscountTypeEnum.DollarsOff:
      return price - flexDiscountAmount
    case DiscountTypeEnum.PercentOff:
      return price * (1 - flexDiscountAmount / 100)
    case DiscountTypeEnum.FixedPrice:
      return flexDiscountAmount
    default:
      return price
  }
}

/**
 * Returns certificate price as formatted string, or null if upgrade not available
 */
const formatProductPrice = (product: ProductFlexiblePrice) => {
  const amount = getFlexiblePriceForProduct(product)
  return Number(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

const priceWithDiscount = ({
  product,
  flexiblePrice,
}: {
  product: ProductFlexiblePrice
  flexiblePrice?: ProductFlexiblePrice
}) => {
  const originalPrice = formatProductPrice(product)
  const finalPrice = flexiblePrice
    ? formatProductPrice(flexiblePrice)
    : originalPrice
  const isDiscounted = originalPrice !== finalPrice

  return {
    isDiscounted,
    /**
     * Indicates if the product has approved financial aid
     * Note: May be zero discount.
     */
    approvedFinancialAid: !!flexiblePrice?.product_flexible_price?.id,
    originalPrice,
    finalPrice,
  }
}

const mitxonlineUrl = (relative: string) => {
  return new URL(relative, NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL).toString()
}

export {
  formatProductPrice,
  priceWithDiscount,
  canUpgradeRun,
  upgradeRunUrl,
  mitxonlineUrl,
}
