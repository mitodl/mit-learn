export {
  analyticsOrganizationQueries,
  analyticsOrganizationKeys,
  analyticsContractQueries,
  analyticsContractKeys,
} from "./queries"

export type {
  AnalyticsPageParams,
  LearnerProgressParams,
  LearnersParams,
  OrgAnalyticsResponse,
} from "./queries"

/**
 * Row and response types for the B2B dashboard tenant of the OL Analytics API,
 * generated from its published OpenAPI spec (`@mitodl/ol-analytics-dashboard-api-axios`).
 *
 * # Why so many nullable numbers
 *
 * The aggregate endpoints apply a k-anonymity floor: any distinct-learner count
 * below the floor, and every rate/average derived from it, comes back `null`.
 * A `null` there means "suppressed to protect learner privacy", NOT zero and
 * NOT missing. Render it as such (see `SuppressibleValue` in the dashboard) and
 * never coerce it to 0 in a chart or an average.
 *
 * # Why the learner outcome fields are nullable
 *
 * `LearnerProgress` and `LearnerEnrollment` are individual learners, so they
 * carry no k-anonymity floor; their outcomes are gated on per-learner consent
 * instead. When `outcomes_shared` is false the API nulls `completion_status`,
 * `is_passing`, `grade`, `letter_grade`, `content_progress`,
 * `certificate_issued_on`, `certificate_is_revoked`, `last_active_on` and
 * `needs_attention`. A `null` there means "the learner has not agreed to share
 * this", a different thing from zero, from absent, and from suppression.
 * `outcomes_consent_status` is always present; `outcomes_shared` also folds in
 * the deployment's default for `not_recorded`, so it can be either value
 * beside that status.
 *
 * `learner_id` is the Keycloak user id (MITx Online's `global_id`). It is
 * stable across email changes, so join on it and never on `email`.
 *
 * `last_active_on` is a plain calendar date (`YYYY-MM-DD`), unlike every other
 * date field, which is a timestamp. `new Date()` reads it as UTC midnight, so
 * formatting it in a negative-offset timezone renders the previous day; parse
 * the parts instead. Read `needs_attention` rather than re-deriving it from
 * `last_active_on`: the 30-day cutoff is resolved in the warehouse's timezone.
 *
 * `CourseRun.courserun_id` carries the readable id (the API aliases
 * `courserun_readable_id AS courserun_id`), so it is what goes back as the
 * `courserun_readable_id` filter despite the different name.
 *
 * `CompletionStatusCounts` sums to `total_count` minus
 * `outcomes_withheld_count`, not `total_count` itself: a consent-withheld
 * enrollment has no `completion_status` and lands in none of the buckets.
 */
export type {
  CompletionStatus,
  CompletionStatusCounts,
  CompletionStatusFilter,
  ConsentStatus,
  ContentEngagementDepth,
  ContractContentEngagementDepth,
  ContractMonthlyEngagementTrend,
  ContractNeedsAttention,
  ContractUtilization,
  CourseRun,
  CourseRunsResponse,
  EnrollmentCompletionFunnel,
  LearnerEnrollment,
  LearnerProgress,
  LearnerProgressResponse,
  LearnersResponse,
  LearnerWithEnrollments,
  MonthlyEngagementTrend,
} from "@mitodl/ol-analytics-dashboard-api-axios"
