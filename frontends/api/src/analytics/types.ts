/**
 * Response types for the B2B dashboard tenant of the OL Analytics API.
 *
 * These are hand-written rather than generated: `ol-analytics-api` does not
 * publish a TypeScript client the way MITx Online does (`@mitodl/mitxonline-api-axios`).
 * They mirror `tenants/b2b_dashboard/models.py` — which in turn mirrors the
 * StarRocks materialized views owned by dbt in `ol-data-platform` — column for
 * column. When a view gains a column, update the matching type here.
 *
 * # Why so many nullable numbers
 *
 * The API applies a k-anonymity floor: any distinct-learner count below the
 * floor, and every rate/average derived from it, comes back `null`. A `null`
 * therefore means "suppressed to protect learner privacy", NOT zero and NOT
 * missing — render it as such (see `SuppressibleValue` in the dashboard) and
 * never coerce it to 0 in a chart or an average.
 */

/**
 * Envelope shared by every org-scoped endpoint.
 *
 * `as_of` is the last refresh time of the single materialized view backing this
 * endpoint, so it is per-section rather than per-page: one lagging view cannot
 * make another section look fresher than it is. It is `null` until that view
 * has refreshed for the first time.
 *
 * `total_count` is how many rows the org has in that view across every page,
 * already net of the anonymity floor. `data.length` alone cannot distinguish a
 * complete result from one truncated at the page cap, so this is what lets the
 * dashboard admit to showing a subset instead of quietly dropping the rest.
 */
export type OrgAnalyticsResponse<RowT> = {
  organization_id: string
  as_of: string | null
  total_count: number
  data: RowT[]
}

/** `mv_b2b_contract_utilization` — grain: org x contract. */
export type ContractUtilization = {
  organization_key: string
  organization_name: string
  contract_pk: string
  contract_id: string
  b2b_contract_name: string
  b2b_contract_is_active: boolean
  b2b_contract_start_date: string | null
  b2b_contract_end_date: string | null
  seat_limit: number | null
  b2b_contract_membership_type: string | null
  seats_consumed: number
  active_learners: number | null
  learners_certified: number | null
  seat_utilization_pct: number | null
  completion_rate_pct: number | null
}

/** `mv_b2b_enrollment_completion_funnel` — grain: org x contract x course run. */
export type EnrollmentCompletionFunnel = {
  organization_key: string
  organization_name: string
  contract_pk: string
  contract_id: string
  b2b_contract_name: string
  courserun_pk: string
  courserun_readable_id: string
  courserun_title: string
  enrolled_learners: number
  active_learners: number | null
  passing_learners: number | null
  certified_learners: number | null
  active_rate_pct: number | null
  completion_rate_pct: number | null
}

/**
 * `mv_b2b_monthly_engagement_trend` — grain: org x year_month.
 *
 * `activity_year_and_month` is a `YYYY-MM` string, not a date.
 */
export type MonthlyEngagementTrend = {
  organization_key: string
  organization_name: string
  activity_year_and_month: string
  monthly_active_learners: number
  new_enrollments: number | null
  enrolling_learners: number | null
  certificates_earned: number | null
  certified_learners: number | null
  total_videos_watched: number | null
  video_watchers: number | null
  total_problems_attempted: number | null
  problem_attempters: number | null
  total_chatbot_interactions: number | null
  chatbot_users: number | null
}

/**
 * `mv_b2b_content_engagement_depth` — grain: org x course run, all-time.
 *
 * Three of these columns are cohort counts rather than metrics a reader asked
 * for: `video_watchers`, `problem_attempters` and `chatbot_users` are the
 * distinct learners behind the activity total beside each of them. The view
 * publishes them so the API can apply the anonymity floor to the cohort that
 * actually produced a sum rather than to a superset of it — an average over
 * one learner *is* that learner's value, however many learners were merely
 * "engaged". Keep each one next to the total it accounts for.
 *
 * The two `avg_*_per_engaged_learner` columns divide by `engaged_learners`,
 * as their names say; the totals above them are contributed only by the
 * narrower cohorts. That split is why both are suppressible independently.
 */
export type ContentEngagementDepth = {
  organization_key: string
  organization_name: string
  courserun_readable_id: string
  courserun_title: string
  total_enrolled_learners: number
  engaged_learners: number | null
  engagement_rate_pct: number | null
  total_videos_watched: number | null
  video_watchers: number | null
  avg_videos_per_engaged_learner: number | null
  total_problems_attempted: number | null
  problem_attempters: number | null
  avg_problems_per_engaged_learner: number | null
  total_chatbot_interactions: number | null
  chatbot_users: number | null
  chatbot_adoption_pct: number | null
  certificates_earned: number | null
}

/**
 * Contract identity, carried by every row of a contract-grained view.
 *
 * `contract_id` is MITx Online's `ContractPage.page_ptr_id` — the value in that
 * dashboard's URLs, and the only one the analytics API will filter on.
 * `contract_pk` is the warehouse's own md5 surrogate: useful as a stable row
 * key, never as a path segment.
 */
type ContractIdentity = {
  contract_pk: string
  contract_id: string
  b2b_contract_name: string
}

/**
 * `mv_b2b_contract_monthly_engagement_trend` — grain: org x contract x month.
 *
 * The same columns as {@link MonthlyEngagementTrend} plus the contract. Note
 * these rows do NOT partition the org-level ones: a learner active under two
 * of an org's contracts is counted in both, so summing
 * `monthly_active_learners` across contracts can exceed the org's own figure.
 */
export type ContractMonthlyEngagementTrend = MonthlyEngagementTrend &
  ContractIdentity

/**
 * `mv_b2b_contract_content_engagement_depth` — grain: org x contract x run.
 *
 * Unlike the trend view these rows ARE a partition of the org-level ones: a
 * course run belongs to exactly one contract, so naming the contract labels a
 * row rather than splitting it.
 */
export type ContractContentEngagementDepth = ContentEngagementDepth &
  ContractIdentity

/**
 * LIMIT/OFFSET paging, shared by every multi-row endpoint. The API caps `limit`
 * at its own `max_page_size` and rejects anything larger with a 422.
 */
export type AnalyticsPageParams = {
  limit?: number
  offset?: number
}

/**
 * `mv_b2b_learner_enrollment` — grain: learner x course run, under one
 * contract. The only endpoint in this tenant that returns individual learners,
 * so unlike every type above it carries no k-anonymity floor.
 *
 * # Why the outcome fields are nullable
 *
 * Outcomes are gated on per-learner consent, not on a suppression floor. When
 * `outcomes_shared` is false the API nulls `completion_status`, `is_passing`,
 * `grade`, `letter_grade`, `certificate_issued_on`, `certificate_is_revoked`,
 * `last_active_on` and `needs_attention` — a `null` there means "the learner
 * has not agreed to share this", which is a different thing from zero, from
 * absent, and from the k-anonymity suppression the aggregate types above use.
 * Render it as such.
 *
 * `learner_id` is the Keycloak user id (MITx Online's `global_id`). It is
 * stable across email changes, so join on it and never on `email`.
 */
export type LearnerProgress = {
  learner_id: string
  email: string | null
  full_name: string | null
  courserun_readable_id: string
  courserun_title: string
  courserun_start_on: string | null
  courserun_end_on: string | null
  enrolled_on: string
  enrollment_is_active: boolean
  enrollment_mode: string | null
  outcomes_shared: boolean
  completion_status: CompletionStatus | null
  is_passing: boolean | null
  grade: number | null
  letter_grade: string | null
  certificate_issued_on: string | null
  certificate_is_revoked: boolean | null
  /**
   * A plain calendar date (`YYYY-MM-DD`), unlike every other date field here,
   * which is a timestamp. `new Date()` reads it as UTC midnight, so formatting
   * it in a negative-offset timezone renders the previous day — parse the
   * parts instead.
   */
  last_active_on: string | null
  /**
   * Whether the learner may need a nudge: they never started, or their last
   * recorded activity was at least 30 days ago. Null only when outcomes are
   * withheld — a consented row with no activity reads `false`, not `null`, so
   * treat it as a plain boolean once `outcomes_shared` is true.
   *
   * Read this rather than re-deriving it from `last_active_on`. The 30-day
   * cutoff is resolved once per request in the warehouse's timezone, so a
   * browser computing its own "today" disagrees for the rows nearest the
   * boundary — the ones the flag exists to surface.
   */
  needs_attention: boolean | null
}

/**
 * `passed` without `certified` is normal rather than an error state:
 * certificates are issued on a schedule after grading, and audit-mode
 * enrollments never certify at all.
 */
export type CompletionStatus =
  | "not_started"
  | "in_progress"
  | "passed"
  | "certified"

/**
 * Accepted by the `completion_status` filter, which additionally takes
 * `unknown` to select the rows whose outcomes are withheld. Not a value any
 * row's `completion_status` can hold.
 */
export type CompletionStatusFilter = CompletionStatus | "unknown"

/**
 * Per-status counts across every enrollment the `learner-progress` endpoint
 * matches, keyed by the same four values as {@link CompletionStatus}. Unlike
 * the aggregate MV types above, this is not floored by k-anonymity (waived for
 * this endpoint per mitodl/ol-analytics-api#58), so none of these are
 * nullable — but they sum to `total_count` minus `outcomes_withheld_count`,
 * not `total_count` itself: a consent-withheld enrollment has no
 * `completion_status` and lands in none of these four buckets. They happen to
 * sum to `total_count` in every environment today only because
 * `outcomes_withheld_count` is currently always zero (consent withholding is
 * inert until a real consent field ships).
 */
export type CompletionStatusCounts = Record<CompletionStatus, number>

export type LearnerProgressSort =
  | "full_name"
  | "email"
  | "enrolled_on"
  | "courserun_readable_id"

export type LearnerProgressParams = AnalyticsPageParams & {
  search?: string
  completion_status?: CompletionStatusFilter[]
  include_inactive?: boolean
  sort?: LearnerProgressSort
  descending?: boolean
  /** Exact match on one course run's readable id — the module filter. */
  courserun_readable_id?: string
  /**
   * `true` keeps only the learners needing attention, `false` only those not.
   * Omit it for no filter.
   *
   * Rows with withheld outcomes match NEITHER value, mirroring the consent
   * gating on the row field: a filter must not reveal the outcome it is
   * withholding. There is no `unknown` escape hatch as there is on
   * `completion_status`, so omitting this is the only way to see those rows.
   */
  needs_attention?: boolean
}

/**
 * The org envelope plus `outcomes_withheld_count`, so a client can say how many
 * rows carry withheld outcomes without paging through all of them. Deliberately
 * not `OrgAnalyticsResponse<LearnerProgress>`: that extra field is specific to
 * this endpoint's consent semantics and does not belong on every section.
 */
export type LearnerProgressResponse = {
  organization_id: string
  as_of: string | null
  total_count: number
  outcomes_withheld_count: number
  completion_status_counts: CompletionStatusCounts
  data: LearnerProgress[]
}

/**
 * One course run under a contract, for the learner-progress module filter.
 *
 * `courserun_id` carries the readable id — the API aliases
 * `courserun_readable_id AS courserun_id` — so it is what goes back as
 * `LearnerProgressParams.courserun_readable_id`, despite the different name.
 *
 * Read from `mv_b2b_contract_courserun`, which is keyed on the contract rather
 * than on enrollments, so this list is neither consent-gated nor limited to
 * runs someone has enrolled in.
 */
export type CourseRun = {
  courserun_id: string
  courserun_title: string
  courserun_start_on: string | null
  courserun_end_on: string | null
}

export type CourseRunsResponse = OrgAnalyticsResponse<CourseRun>

/**
 * Distinct learners needing attention — grain: org x contract. Computed at
 * query time from the same expression as `LearnerProgress.needs_attention`,
 * not read from a materialized view, so this count and the learner
 * directory's filter cannot disagree.
 *
 * A learner needs attention if they never started, or are in progress with no
 * recorded activity in at least 30 days; each is counted once however many
 * courses they are behind in. That makes this a learner count, unlike
 * `LearnerProgressResponse.needs_attention_count`, which counts enrollments.
 *
 * `learners_considered` (active enrollments only) gates the row: below the
 * anonymity floor the contract has no row at all. The two outcome counts are
 * floored independently, and the three do not sum.
 */
export type ContractNeedsAttention = {
  contract_id: number
  learners_considered: number
  learners_needing_attention: number | null
  learners_outcomes_withheld: number | null
}

export type ContractNeedsAttentionResponse =
  OrgAnalyticsResponse<ContractNeedsAttention>
