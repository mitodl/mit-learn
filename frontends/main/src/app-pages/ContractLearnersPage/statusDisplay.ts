import type { LearnerProgress } from "api/analytics-hooks/organizations"

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
  | "not-started"
  | "in-progress"
  | "completed"
  | "certificate"
  | "not-shared"
  | "unknown"

const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  completed: "Completed",
  certificate: "Certificate",
  "not-shared": "No consent given",
  unknown: "Unknown",
}

const getDisplayStatus = (row: LearnerProgress): DisplayStatus => {
  // Consent is checked before the status itself: the API nulls the outcome
  // fields when it is withheld, so a null here is ambiguous on its own.
  if (!row.outcomes_shared) return "not-shared"

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
      // A row that consented but carries a `completion_status` outside the
      // four known values — e.g. a value the API added after this type was
      // written. Distinct from "not-shared": that's a consent state, this is
      // an unrecognized one, and conflating them would misreport a consenting
      // learner as having withheld consent.
      return "unknown"
  }
}

export { getDisplayStatus, DISPLAY_STATUS_LABEL }
export type { DisplayStatus }
