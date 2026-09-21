import React from "react"

// "free" covers every non-paid enrollment — active audit ("Start Learning") and
// the degraded archived/deadline-passed audit ("Access Course Materials"). They
// hit the same free-enrollment path; only the button label differs.
export type EnrollActionKind = "paid" | "free"

export type EnrollAction = {
  kind: EnrollActionKind
  label: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

// Discriminated — "enrolled" is the collapse state, not an "option"; "none" = no button.
export type EnrollAreaState =
  | { status: "enrolled"; href: string }
  | { status: "options"; options: EnrollAction[] }
  | { status: "none" }

/**
 * The financial aid state for a certificate card. `applied` reports an approved
 * flexible price; `pending` reports that the user-scoped lookup answering that
 * question is still in flight, which callers use to withhold the link rather
 * than render the "apply" call to action at an already-approved user.
 */
export type FinancialAid = {
  href: string
  applied: boolean
  pending: boolean
}

/**
 * The one discount checkout will apply for this learner, broken into rows that
 * subtract. Every amount comes from the same quote, so they cannot disagree.
 */
export type AppliedSavings = {
  /** Row 1: the product's price. The view supplies the noun that labels it. */
  fullPrice: string
  /** Row 2, unsigned — the view renders the sign. */
  amountOff: string
  /** Row 3: what checkout charges. */
  todaysPrice: string
  /** The credited purchase, when the discount names one. */
  sourceTitle: string | null
  kind: "credit" | "aid" | "other"
}

/**
 * What a product lets you enroll in right now — the ACTIONABLE offering, not
 * the raw enrollment modes (a paid path additionally requires a purchasable
 * product). Derived by courseRun.getCourseScenario (per selected run) and
 * programOffering.getProgramOffering (per program).
 */
export type Offering = "none" | "free" | "paid" | "both"

/**
 * How many offering boxes the enroll area renders: an enrolled user collapses
 * to a single box regardless of offering. The count-aware grid layout reads
 * this so it can't disagree with what the enroll areas render.
 */
export const offeringBoxCount = (
  offering: Offering,
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
