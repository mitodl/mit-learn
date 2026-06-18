import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  getBestRun,
  getEnrollmentType,
  canPurchaseRun,
} from "@/common/mitxonline"

export const getEnrollableRuns = (
  course: CourseWithCourseRunsSerializerV2,
): CourseRunV2[] => {
  return (course.courseruns ?? []).filter((run) => run.is_enrollable)
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
