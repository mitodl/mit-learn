import type {
  BaseProduct,
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
  EnrollmentMode,
  ProductFlexiblePrice,
  V2ProgramRequirement,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  DiscountTypeEnum,
  EnrollmentModeEnum,
  NodeTypeEnum,
} from "@mitodl/mitxonline-api-axios/v2"
import invariant from "tiny-invariant"

const NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL =
  process.env.NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL
invariant(
  NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL,
  "NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL must be set",
)

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
 * formatPrice(100, { avoidCents: false }) // "$100.00"
 * formatPrice(100.5, { avoidCents: false }) // "$100.50"
 * ```
 */
const formatPrice = (
  amount: number | string,
  { avoidCents = true } = {},
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
  avoidCents = true,
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

/**
 * Adding the `ecom-service=true` query parameter hides the MITxOnline-branded header
 * on the MITxOnline site.
 */
const ECOM_SERVICE_KEY = "ecom-service"
const mitxonlineLegacyUrl = (relative: string) => {
  const url = new URL(relative, NEXT_PUBLIC_MITX_ONLINE_LEGACY_BASE_URL)
  const search = new URLSearchParams(url.search)
  search.set(ECOM_SERVICE_KEY, "true")
  url.search = search.toString()
  return url.toString()
}

type EnrollmentType = "none" | "free" | "paid" | "both"

type CourseRunEnrollmentActionNone = { type: "none" }
type CourseRunEnrollmentActionAudit = {
  type: "audit"
  run: CourseRunV2
}
type CourseRunEnrollmentActionCheckout = {
  type: "checkout"
  run: CourseRunV2
  product: BaseProduct
}
type CourseRunEnrollmentActionDialog = { type: "dialog" }

type CourseEnrollmentAction =
  | CourseRunEnrollmentActionNone
  | CourseRunEnrollmentActionAudit
  | CourseRunEnrollmentActionCheckout
  | CourseRunEnrollmentActionDialog

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
 * Determine course enrollment action using enrollable runs only.
 * If there is a choice to be made by the user, open the dialog.
 * Otherwise, direct them to the appropriate action (audit, checkout, or none).
 *
 * Rules:
 * - Multiple enrollable runs -> dialog
 * - Single enrollable run with both modes -> dialog
 * - Single enrollable run with audit only -> one-click enrollment
 * - Single enrollable run with verified only -> checkout
 */
const getCourseEnrollmentAction = (
  course: CourseWithCourseRunsSerializerV2,
): CourseEnrollmentAction => {
  const enrollableRuns = (course.courseruns ?? []).filter(
    (run) => run.is_enrollable,
  )
  const selectedRun = getBestRun(course, { enrollableOnly: true })

  if (!selectedRun) return { type: "none" }
  if (enrollableRuns.length > 1) return { type: "dialog" }

  const enrollmentType = getEnrollmentType(selectedRun.enrollment_modes)
  if (enrollmentType === "both") return { type: "dialog" }
  if (enrollmentType === "free") return { type: "audit", run: selectedRun }
  if (enrollmentType === "paid") {
    const product = selectedRun.products?.[0]
    if (!product) return { type: "none" }
    return { type: "checkout", run: selectedRun, product }
  }
  return { type: "none" }
}

type ProgramRequirementSection = {
  /**
   * The source operator node, returned as a convenience back-reference for
   * consumers that still need raw-tree operations (e.g. the dashboard's
   * `getRequirementsProgress(V2ProgramRequirement[])`). It is NOT an invitation
   * to bypass the derived fields (`items`, `operator`, `requiredCount`,
   * `rawTitle`, `elective`). Note: `id === node.id` — a convenience stable
   * identifier.
   */
  node: V2ProgramRequirement
  id: number | null | undefined
  elective: boolean
  operator: string | null
  requiredCount: number
  rawTitle: string | null
  items: { type: "course" | "program"; id: number }[]
}

/**
 * Parse a program's req_tree into ordered operator sections.
 *
 * Structure-only: returns ids + operator metadata + rawTitle.
 * No default/fallback titles, no display copy, no completion/progress logic,
 * no entity resolution, no logging. Consumer is responsible for all of that.
 *
 * Note: the product `parseReqTree` (`ProductPages/util.ts`) will migrate onto
 * this helper in a later separate PR — that is why two structurally-similar
 * functions currently coexist.
 *
 * The parser walks the tree recursively for parity with the legacy
 * `extractResourcesFromNode`. The flat-`req_tree` invariant (operators never
 * nest operators) makes recursion equivalent to iterating direct children, so
 * this stays consistent with `getRequirementsProgress`, which counts direct
 * children only.
 */
const parseProgramRequirementSections = (
  reqTree: V2ProgramRequirement[],
): ProgramRequirementSection[] => {
  return reqTree
    .filter((node) => node.data.node_type === NodeTypeEnum.Operator)
    .map((node) => {
      const items: { type: "course" | "program"; id: number }[] = []
      const walk = (children: V2ProgramRequirement[]) => {
        for (const child of children) {
          if (
            child.data.node_type === NodeTypeEnum.Course &&
            typeof child.data.course === "number"
          ) {
            items.push({ type: "course", id: child.data.course })
          } else if (
            child.data.node_type === NodeTypeEnum.Program &&
            typeof child.data.required_program === "number"
          ) {
            items.push({ type: "program", id: child.data.required_program })
          }
          if (child.children) walk(child.children)
        }
      }
      walk(node.children ?? [])

      // Mirrors parseReqTree's formula exactly on purpose (including NaN when
      // operator_value is absent/non-numeric) so the deferred product migration
      // is a behavior no-op — do not "fix" the NaN path here.
      const requiredCount =
        node.data.operator === "min_number_of"
          ? Number(node.data.operator_value)
          : items.length

      return {
        node,
        id: node.id,
        elective: node.data.elective_flag ?? false,
        operator: node.data.operator ?? null,
        requiredCount,
        rawTitle: node.data.title ?? null,
        items,
      }
    })
}

/**
 * Extract all course and program IDs from a program's req_tree.
 * This is the single source of truth for which courses/programs belong to a program.
 */
const getIdsFromReqTree = (
  nodes: V2ProgramRequirement[],
): { courseIds: number[]; programIds: number[] } => {
  const courseIds: number[] = []
  const programIds: number[] = []
  const walk = (children: V2ProgramRequirement[]) => {
    for (const node of children) {
      if (
        node.data.node_type === NodeTypeEnum.Course &&
        typeof node.data.course === "number"
      ) {
        courseIds.push(node.data.course)
      } else if (
        node.data.node_type === NodeTypeEnum.Program &&
        typeof node.data.required_program === "number"
      ) {
        programIds.push(node.data.required_program)
      }
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)
  return { courseIds, programIds }
}

export * from "./enrollmentAlert"

/**
 * Returns the best run for a course.
 *
 * Prefers the run matching `next_run_id` among candidates; falls back to the
 * first candidate.
 *
 * @param opts.enrollableOnly - only consider runs where `is_enrollable` is true
 *   (use this on the dashboard where enrollment is the goal)
 * @param opts.contractId - only consider runs matching this B2B contract
 */
const getBestRun = (
  course: CourseWithCourseRunsSerializerV2,
  opts?: { contractId?: number; enrollableOnly?: boolean },
): CourseRunV2 | undefined => {
  const { contractId, enrollableOnly = false } = opts ?? {}
  let runs = course.courseruns ?? []
  if (enrollableOnly) runs = runs.filter((run) => run.is_enrollable)
  if (contractId) runs = runs.filter((run) => run.b2b_contract === contractId)
  return runs.find((run) => run.id === course.next_run_id) ?? runs[0]
}

const isVerifiedEnrollmentMode = (mode?: string | null) => {
  return mode === EnrollmentModeEnum.Verified
}

export {
  formatPrice,
  priceWithDiscount,
  canPurchaseRun,
  upgradeRunUrl,
  mitxonlineLegacyUrl,
  getEnrollmentType,
  getCourseEnrollmentAction,
  getIdsFromReqTree,
  parseProgramRequirementSections,
  getBestRun,
  isVerifiedEnrollmentMode,
}
export type {
  PriceWithDiscount,
  EnrollmentType,
  CourseEnrollmentAction,
  ProgramRequirementSection,
}
