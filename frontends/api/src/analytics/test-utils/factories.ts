import { faker } from "@faker-js/faker/locale/en"
import type {
  ContentEngagementDepth,
  ContractUtilization,
  EnrollmentCompletionFunnel,
  MonthlyEngagementTrend,
  OrgAnalyticsResponse,
  ProgramFunnel,
} from "../types"

/**
 * Factories for the analytics API's org-scoped responses.
 *
 * Every nullable count here defaults to a real number: suppression is the
 * exception, so a test that cares about it opts in by passing `null` rather
 * than every other test having to opt out.
 */

const organizationId = () => faker.string.uuid()

/**
 * `contract_pk`, `courserun_pk` and `program_pk` are dbt surrogate keys —
 * `dbt_utils.generate_surrogate_key` MD5-hashes its inputs, so they are
 * 32-character lowercase hex strings, never integers. Fixtures that generated
 * numbers here were passing while production sent strings (ol-analytics-api#29,
 * which 500ed on exactly that mismatch server-side).
 */
const surrogateKey = () =>
  faker.string.hexadecimal({ length: 32, casing: "lower", prefix: "" })

const envelope = <RowT>(
  data: RowT[],
  overrides: Partial<OrgAnalyticsResponse<RowT>> = {},
): OrgAnalyticsResponse<RowT> => ({
  organization_id: organizationId(),
  as_of: "2026-07-01T04:00:00Z",
  // Defaults to a complete result set; a test exercising truncation passes a
  // larger total explicitly.
  total_count: data.length,
  data,
  ...overrides,
})

const contractUtilization = (
  overrides: Partial<ContractUtilization> = {},
): ContractUtilization => ({
  organization_key: faker.string.alphanumeric(6).toUpperCase(),
  organization_name: faker.company.name(),
  contract_pk: surrogateKey(),
  b2b_contract_name: `${faker.company.name()} Contract`,
  b2b_contract_is_active: true,
  b2b_contract_start_date: "2026-01-01",
  b2b_contract_end_date: "2026-12-31",
  seat_limit: 100,
  b2b_contract_membership_type: "fixed",
  seats_consumed: 62,
  active_learners: 48,
  learners_certified: 20,
  seat_utilization_pct: 62,
  completion_rate_pct: 32.3,
  ...overrides,
})

const enrollmentCompletionFunnel = (
  overrides: Partial<EnrollmentCompletionFunnel> = {},
): EnrollmentCompletionFunnel => ({
  organization_key: faker.string.alphanumeric(6).toUpperCase(),
  organization_name: faker.company.name(),
  contract_pk: surrogateKey(),
  b2b_contract_name: `${faker.company.name()} Contract`,
  courserun_pk: surrogateKey(),
  courserun_readable_id: `course-v1:MITx+${faker.string.alphanumeric(5)}+2026`,
  courserun_title: faker.commerce.productName(),
  enrolled_learners: 40,
  active_learners: 31,
  passing_learners: 18,
  certified_learners: 16,
  active_rate_pct: 77.5,
  completion_rate_pct: 40,
  ...overrides,
})

const monthlyEngagementTrend = (
  overrides: Partial<MonthlyEngagementTrend> = {},
): MonthlyEngagementTrend => ({
  organization_key: faker.string.alphanumeric(6).toUpperCase(),
  organization_name: faker.company.name(),
  activity_year_and_month: "2026-01",
  monthly_active_learners: 30,
  new_enrollments: 12,
  enrolling_learners: 10,
  certificates_earned: 5,
  certified_learners: 5,
  total_videos_watched: 900,
  video_watchers: 22,
  total_problems_attempted: 1200,
  problem_attempters: 25,
  total_chatbot_interactions: 80,
  chatbot_users: 14,
  ...overrides,
})

const programFunnel = (
  overrides: Partial<ProgramFunnel> = {},
): ProgramFunnel => ({
  organization_key: faker.string.alphanumeric(6).toUpperCase(),
  organization_name: faker.company.name(),
  contract_pk: surrogateKey(),
  b2b_contract_name: `${faker.company.name()} Contract`,
  program_pk: surrogateKey(),
  program_title: `${faker.commerce.department()} Program`,
  total_courses: 6,
  enrolled_in_contract_courses: 50,
  enrolled_via_program: 30,
  program_course_completers: 12,
  ...overrides,
})

const contentEngagementDepth = (
  overrides: Partial<ContentEngagementDepth> = {},
): ContentEngagementDepth => ({
  organization_key: faker.string.alphanumeric(6).toUpperCase(),
  organization_name: faker.company.name(),
  courserun_readable_id: `course-v1:MITx+${faker.string.alphanumeric(5)}+2026`,
  courserun_title: faker.commerce.productName(),
  total_enrolled_learners: 40,
  engaged_learners: 28,
  engagement_rate_pct: 70,
  total_videos_watched: 800,
  video_watchers: 22,
  avg_videos_per_engaged_learner: 28.6,
  total_problems_attempted: 1000,
  problem_attempters: 24,
  avg_problems_per_engaged_learner: 35.7,
  total_chatbot_interactions: 60,
  chatbot_users: 14,
  chatbot_adoption_pct: 35,
  certificates_earned: 16,
  ...overrides,
})

export {
  contentEngagementDepth,
  contractUtilization,
  enrollmentCompletionFunnel,
  envelope,
  monthlyEngagementTrend,
  organizationId,
  programFunnel,
}
