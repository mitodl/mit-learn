import type {
  BaseProduct,
  CourseRunV2,
  EnrollmentMode,
  ProductFlexiblePrice,
  V2ProgramRequirement,
} from "@mitodl/mitxonline-api-axios/v2"
import { DiscountTypeEnum, NodeTypeEnum } from "@mitodl/mitxonline-api-axios/v2"
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

const canPurchaseRun = (run: CourseRunV2): boolean => {
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
 * Format the numeric part of a price:
 * ```ts
 * formatPrice(100) // "$100"
 * formatPrice(100.5) // "$100.50"
 * formatPrice(100, { avoidCents: true }) // "$100"
 * formatPrice(100.5, { avoidCents: true }) // "$100.50"
 * ```
 */
const formatPrice = (
  amount: number | string,
  { avoidCents = false } = {},
): string => {
  const num = Number(amount)
  const fractionDigits = avoidCents && Number.isInteger(num) ? 0 : 2
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

type PriceWithDiscount = {
  isDiscounted: boolean
  /**
   * Indicates if the product has approved financial aid
   * Note: May be zero discount.
   */
  approvedFinancialAid: boolean
  originalPrice: string
  finalPrice: string
}
const priceWithDiscount = ({
  product,
  flexiblePrice,
  avoidCents = false,
}: {
  product: BaseProduct
  flexiblePrice?: ProductFlexiblePrice
  avoidCents?: boolean
}): PriceWithDiscount => {
  const originalPrice = formatPrice(product.price, { avoidCents })
  const finalPrice = flexiblePrice
    ? formatPrice(getFlexiblePriceForProduct(flexiblePrice), { avoidCents })
    : originalPrice
  const isDiscounted = originalPrice !== finalPrice

  return {
    isDiscounted,
    approvedFinancialAid: !!flexiblePrice?.product_flexible_price?.id,
    originalPrice,
    finalPrice,
  }
}

const mitxonlineUrl = (relative: string) => {
  return new URL(relative, NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL).toString()
}

type EnrollmentType = "none" | "free" | "paid" | "both"

const getEnrollmentType = (
  modes: EnrollmentMode[] | undefined,
): EnrollmentType => {
  if (!modes || modes.length === 0) return "none"
  const hasFree = modes.some((m) => !m.requires_payment)
  const hasPaid = modes.some((m) => m.requires_payment)
  if (hasFree && hasPaid) return "both"
  if (hasFree) return "free"
  return "paid"
}

/**
 * Extract all course IDs from a program's req_tree.
 * This is the single source of truth for which courses belong to a program.
 */
const getCourseIdsFromReqTree = (nodes: V2ProgramRequirement[]): number[] =>
  nodes.flatMap((node) => {
    if (
      node.data.node_type === NodeTypeEnum.Course &&
      typeof node.data.course === "number"
    ) {
      return [node.data.course]
    }
    return getCourseIdsFromReqTree(node.children ?? [])
  })

export {
  formatPrice,
  priceWithDiscount,
  canPurchaseRun,
  upgradeRunUrl,
  mitxonlineUrl,
  getEnrollmentType,
  getCourseIdsFromReqTree,
}
export type { PriceWithDiscount, EnrollmentType }
