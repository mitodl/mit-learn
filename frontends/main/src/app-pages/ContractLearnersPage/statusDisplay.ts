import type { LearnerEnrollment } from "api/analytics-hooks/organizations"

/**
 * What the status pill shows, mapped directly from the API's
 * `completion_status`: `passed` reads "Completed", `certified` reads
 * "Certificate".
 *
 * This used to collapse `passed` into "Certificate" for verified enrollments,
 * proxying "will this course issue a certificate" off enrollment track. That
 * proxy over-fired — a verified learner in a course with no certificate track
 * still read "Certificate" — and it also meant the Status filter's "Completed"
 * option could return a results table where every row said "Certificate",
 * which read as broken. Restore the proxy only once the real signal (MITx
 * Online's `Course.certificate_page`) lands via `ol-analytics-api` — see
 * mitxonline#3958 and ol-analytics-api#58.
 */
type DisplayStatus =
  "not-started" | "in-progress" | "completed" | "certificate" | "unknown"

const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  completed: "Completed",
  certificate: "Certificate",
  unknown: "Unknown",
}

/** Requests already leave out learners who haven't consented; this keeps a status from leaking if one gets through. */
const getDisplayStatus = (row: LearnerEnrollment): DisplayStatus => {
  if (row.outcomes_consent_status !== "consented" || !row.outcomes_shared) {
    return "unknown"
  }
  switch (row.completion_status) {
    case "certified":
      return "certificate"
    case "passed":
      return "completed"
    case "in_progress":
      return "in-progress"
    case "not_started":
      return "not-started"
    default:
      /** A status outside the four known values, e.g. one the API added after this type was written. */
      return "unknown"
  }
}

const isStartedStatus = (status: DisplayStatus) =>
  status === "in-progress" || status === "completed" || status === "certificate"

/** Whole percent of content completed, or null where progress isn't shown. */
const contentProgressPercent = (
  row: LearnerEnrollment,
  status: DisplayStatus,
) =>
  isStartedStatus(status) && typeof row.content_progress === "number"
    ? Math.round(row.content_progress * 100)
    : null

export { contentProgressPercent, getDisplayStatus, DISPLAY_STATUS_LABEL }
export type { DisplayStatus }
