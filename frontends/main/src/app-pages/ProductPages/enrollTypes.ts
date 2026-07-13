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
