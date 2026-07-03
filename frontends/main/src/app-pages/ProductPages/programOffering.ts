import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { getEnrollmentType } from "@/common/mitxonline"

/**
 * What a program lets you enroll in right now:
 * - "both": free audit and a purchasable paid certificate
 * - "paid": purchasable paid certificate only
 * - "free": free audit only
 * - "none": nothing enrollable
 *
 * This is the ACTIONABLE offering, not the raw enrollment-modes offering: a
 * paid path requires a purchasable product (`products[0]` with a price).
 * Without one, "paid" demotes to "none" and "both" demotes to "free" — there's
 * nothing to sell, so the paid card/button can't be rendered.
 */
export type ProgramOffering = "none" | "free" | "paid" | "both"

export const getProgramOffering = (
  program: V2ProgramDetail,
): ProgramOffering => {
  const type = getEnrollmentType(program.enrollment_modes)
  const hasFree = type === "free" || type === "both"
  const offersPaid = type === "paid" || type === "both"
  const purchasable = offersPaid && Boolean(program.products[0]?.price)

  if (purchasable) return hasFree ? "both" : "paid"
  if (hasFree) return "free"
  return "none"
}

/**
 * How many offering boxes the enroll area renders: an enrolled user collapses
 * to a single box regardless of offering. Mirrors courseRun.offeringBoxCount.
 */
export const programOfferingBoxCount = (
  offering: ProgramOffering,
  isEnrolled: boolean,
): 0 | 1 | 2 => {
  if (isEnrolled) return 1
  switch (offering) {
    case "none":
      return 0
    case "both":
      return 2
    default:
      return 1
  }
}
