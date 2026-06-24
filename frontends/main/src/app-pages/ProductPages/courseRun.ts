import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  getBestRun,
  getEnrollmentType,
  canPurchaseRun,
} from "@/common/mitxonline"
import { isInPast } from "ol-utilities"

export const getEnrollableRuns = (
  course: CourseWithCourseRunsSerializerV2,
): CourseRunV2[] => {
  return (course.courseruns ?? []).filter((run) => run.is_enrollable)
}

/**
 * True when a run is self-paced, not archived, and its start date is already in
 * the past — i.e. "enroll anytime". Shared by the session selector option labels
 * and the metadata date row so the two can't drift.
 */
export const runStartsAnytime = (run: CourseRunV2): boolean => {
  return !!(
    !run.is_archived &&
    run.is_self_paced &&
    run.start_date &&
    isInPast(run.start_date)
  )
}

/**
 * Comparator ordering runs by start date, latest first (upcoming sessions on
 * top); runs without a start date sort last. Shared by the session selector and
 * the "More Dates" list so their orderings stay identical.
 */
export const byStartDateDesc = (a: CourseRunV2, b: CourseRunV2): number => {
  const aTime = a.start_date ? new Date(a.start_date).getTime() : -Infinity
  const bTime = b.start_date ? new Date(b.start_date).getTime() : -Infinity
  return bTime - aTime
}

export const getSelectedRun = (
  course: CourseWithCourseRunsSerializerV2,
  selectedRunId?: number | null,
): CourseRunV2 | undefined => {
  if (selectedRunId !== undefined && selectedRunId !== null) {
    const enrollable = getEnrollableRuns(course)
    const found = enrollable.find((run) => run.id === selectedRunId)
    if (found) return found
  }
  return getBestRun(course, { enrollableOnly: true })
}

/**
 * What the selected run lets you enroll in right now:
 * - "both": free audit and a purchasable paid certificate
 * - "paid": purchasable paid certificate only
 * - "free": free audit only
 * - "none": nothing enrollable (no run, or a paid-only run past its deadline)
 */
export type CourseOffering = "none" | "free" | "paid" | "both"

/**
 * Lifecycle of the selected run. "active" is the normal case; the others are
 * degraded states that render a warning and cap enrollment at free audit:
 * - "deadlinePassed": the paid-certificate window has closed
 * - "archived": the course has ended; content remains available to audit
 */
export type CourseStatus = "active" | "deadlinePassed" | "archived"

/**
 * The selected run's enrollment scenario as two orthogonal facets: what's
 * enrollable (`offering`) and the lifecycle `status`. Modeled as a discriminated
 * union so the impossible combinations are unrepresentable — a degraded run
 * can't still offer a purchasable certificate, and an archived run is always
 * audit-only. The degraded variants carry `offeredCertificate` so a consumer can
 * note a passed certificate deadline without re-parsing the run's modes.
 */
export type CourseScenario =
  | { status: "active"; offering: CourseOffering }
  | {
      status: "deadlinePassed"
      offering: "free" | "none"
      offeredCertificate: true
    }
  | { status: "archived"; offering: "free"; offeredCertificate: boolean }

export const getCourseScenario = (
  run: CourseRunV2 | undefined,
): CourseScenario => {
  if (!run) return { status: "active", offering: "none" }
  const type = getEnrollmentType(run.enrollment_modes) // "none" | "free" | "paid" | "both"
  const hasFree = type === "free" || type === "both"
  const offersPaid = type === "paid" || type === "both"
  // Archived grants free audit access to the (ended) content regardless of the
  // run's original modes — the established product behavior (see legacy
  // CourseProductDetailEnroll: `is_archived ? "Access Course Materials"`).
  // offeredCertificate records whether a paid track existed, so an audit-only
  // archived run doesn't claim a certificate deadline it never had.
  if (run.is_archived) {
    return {
      status: "archived",
      offering: "free",
      offeredCertificate: offersPaid,
    }
  }
  const purchasable = canPurchaseRun(run) // is_enrollable && !archived && is_upgradable && has product
  if (offersPaid && purchasable) {
    return { status: "active", offering: hasFree ? "both" : "paid" }
  }
  if (offersPaid && !purchasable) {
    // Paid window closed. Free audit remains if the run also offers it;
    // otherwise nothing is enrollable, but we still surface the closed-deadline
    // warning rather than silently showing no offering at all.
    return {
      status: "deadlinePassed",
      offering: hasFree ? "free" : "none",
      offeredCertificate: true,
    }
  }
  if (hasFree) return { status: "active", offering: "free" }
  return { status: "active", offering: "none" }
}

/**
 * How many offering boxes the enroll area renders for a run: an enrolled user
 * collapses to a single box regardless of offering; otherwise "both" shows two
 * tracks, a single track shows one, and "none" shows zero. The count-aware grid
 * layout reads this so it can't disagree with what CourseEnrollArea renders.
 */
export const offeringBoxCount = (
  scenario: CourseScenario,
  isEnrolled: boolean,
): 0 | 1 | 2 => {
  if (isEnrolled) return 1
  switch (scenario.offering) {
    case "none":
      return 0
    case "both":
      return 2
    default:
      return 1
  }
}
