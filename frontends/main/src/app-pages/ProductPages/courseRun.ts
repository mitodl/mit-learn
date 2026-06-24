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

export type CourseScenarioKind =
  | "both"
  | "paidOnly"
  | "freeOnly"
  | "deadlinePassed"
  | "archived"
  | "none"

export const getCourseScenario = (
  run: CourseRunV2 | undefined,
): CourseScenarioKind => {
  if (!run) return "none"
  if (run.is_archived) return "archived"
  const type = getEnrollmentType(run.enrollment_modes) // "none" | "free" | "paid" | "both"
  const hasFree = type === "free" || type === "both"
  const offersPaid = type === "paid" || type === "both"
  const purchasable = canPurchaseRun(run) // is_enrollable && !archived && is_upgradable && has product
  if (offersPaid && purchasable) return hasFree ? "both" : "paidOnly"
  if (offersPaid && !purchasable) return hasFree ? "deadlinePassed" : "none" // paid-only-expired → none
  if (hasFree) return "freeOnly"
  return "none"
}
