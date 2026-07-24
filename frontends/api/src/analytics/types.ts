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
 */
export type OrgAnalyticsResponse<RowT> = {
  organization_id: string
  as_of: string | null
  data: RowT[]
}

/** `mv_b2b_contract_utilization` — grain: org x contract. */
export type ContractUtilization = {
  organization_key: string
  organization_name: string
  contract_pk: number
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
  contract_pk: number
  b2b_contract_name: string
  courserun_pk: number
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
  certificates_earned: number | null
  total_videos_watched: number
  total_problems_attempted: number
  total_chatbot_interactions: number
}

/** `mv_b2b_program_funnel` — grain: org x contract x program. */
export type ProgramFunnel = {
  organization_key: string
  organization_name: string
  contract_pk: number
  b2b_contract_name: string
  program_pk: number
  program_title: string
  total_courses: number
  enrolled_in_contract_courses: number
  enrolled_via_program: number | null
  program_course_completers: number | null
}

/** `mv_b2b_content_engagement_depth` — grain: org x course run, all-time. */
export type ContentEngagementDepth = {
  organization_key: string
  organization_name: string
  courserun_readable_id: string
  courserun_title: string
  total_enrolled_learners: number
  engaged_learners: number | null
  engagement_rate_pct: number | null
  total_videos_watched: number | null
  avg_videos_per_engaged_learner: number | null
  total_problems_attempted: number | null
  avg_problems_per_engaged_learner: number | null
  total_chatbot_interactions: number | null
  chatbot_users: number | null
  chatbot_adoption_pct: number | null
  certificates_earned: number | null
}

/**
 * LIMIT/OFFSET paging, shared by every multi-row endpoint. The API caps `limit`
 * at its own `max_page_size` and rejects anything larger with a 422.
 */
export type AnalyticsPageParams = {
  limit?: number
  offset?: number
}
