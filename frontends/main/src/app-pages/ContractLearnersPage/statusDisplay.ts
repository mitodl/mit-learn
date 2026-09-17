import type { LearnerProgress } from "api/analytics-hooks/organizations"

/**
 * What the status pill shows, which is not one-to-one with the API's
 * `completion_status`.
 *
 * The API distinguishes `passed` (a passing grade) from `certified` (an
 * unrevoked certificate). The dashboard deliberately collapses them: a learner
 * who passed a course that issues certificates reads "Certificate" even before
 * the certificate is generated, because certificates are issued on a schedule
 * and surfacing the wait as its own state was judged more confusing than
 * useful. A course that issues no certificate reads "Completed" instead.
 *
 * Consequence worth knowing before relying on this cell: "Certificate" means
 * "finished a course that certifies", NOT "holds a certificate today".
 */
type DisplayStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | "certificate"
  | "not-shared"

const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  completed: "Completed",
  certificate: "Certificate",
  "not-shared": "No consent given",
}

/**
 * The API exposes no "does this course issue certificates" field. The enrollment
 * track is the available proxy: audit enrollments never certify, so a passing
 * audit learner has completed as far as they can go.
 */
const canEarnCertificate = (row: LearnerProgress): boolean =>
  row.enrollment_mode?.toLowerCase() === "verified"

const getDisplayStatus = (row: LearnerProgress): DisplayStatus => {
  // Consent is checked before the status itself: the API nulls the outcome
  // fields when it is withheld, so a null here is ambiguous on its own.
  if (!row.outcomes_shared) return "not-shared"

  switch (row.completion_status) {
    case "certified":
      return "certificate"
    case "passed":
      return canEarnCertificate(row) ? "certificate" : "completed"
    case "in_progress":
      return "in-progress"
    case "not_started":
      return "not-started"
    default:
      return "not-shared"
  }
}

export { getDisplayStatus, DISPLAY_STATUS_LABEL, canEarnCertificate }
export type { DisplayStatus }
