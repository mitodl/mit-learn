import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { getEnrollmentType } from "@/common/mitxonline"
import type { Offering } from "./enrollTypes"

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
export type ProgramOffering = Offering

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
