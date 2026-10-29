import { queryify } from "ol-test-utilities"
import analyticsAxios from "../axios"
import type {
  AnalyticsPageParams,
  LearnerProgressParams,
  LearnersParams,
} from "../hooks/organizations"

/**
 * Where ol-analytics-api mounts the b2b_dashboard tenant. Written out here
 * rather than read from the client, so a spec change that moves the mount
 * fails these tests instead of moving the expectation along with it.
 */
const B2B_DASHBOARD_ROOT = "/api/v1/analytics"

// Absolute, and read back from the configured axios instance, so the shared
// request mock can tell analytics requests apart from Learn and MITx ones by
// origin — same reasoning as the mitxonline URL builders.
const getApiBaseUrl = () => analyticsAxios.defaults.baseURL

const orgResource = (
  organizationId: string,
  resource: string,
  params?: AnalyticsPageParams,
) =>
  // queryify supplies its own leading "?" (and "" when there are no params).
  `${getApiBaseUrl()}${B2B_DASHBOARD_ROOT}/organizations/${encodeURIComponent(
    organizationId,
  )}/${resource}${queryify(params)}`

const contractResource = (
  organizationId: string,
  contractId: number,
  resource: string,
  params?: AnalyticsPageParams | LearnerProgressParams,
) =>
  `${getApiBaseUrl()}${B2B_DASHBOARD_ROOT}/organizations/${encodeURIComponent(
    organizationId,
  )}/contracts/${contractId}/${resource}${queryify(params)}`

const organizations = {
  contractUtilization: (organizationId: string, params?: AnalyticsPageParams) =>
    orgResource(organizationId, "contract-utilization", params),
  enrollmentFunnel: (organizationId: string, params?: AnalyticsPageParams) =>
    orgResource(organizationId, "enrollment-funnel", params),
  engagementTrend: (organizationId: string, params?: AnalyticsPageParams) =>
    orgResource(organizationId, "engagement-trend", params),
  contentEngagement: (organizationId: string, params?: AnalyticsPageParams) =>
    orgResource(organizationId, "content-engagement", params),
}

const contracts = {
  contractUtilization: (
    organizationId: string,
    contractId: number,
    params?: AnalyticsPageParams,
  ) =>
    contractResource(
      organizationId,
      contractId,
      "contract-utilization",
      params,
    ),
  enrollmentFunnel: (
    organizationId: string,
    contractId: number,
    params?: AnalyticsPageParams,
  ) =>
    contractResource(organizationId, contractId, "enrollment-funnel", params),
  engagementTrend: (
    organizationId: string,
    contractId: number,
    params?: AnalyticsPageParams,
  ) => contractResource(organizationId, contractId, "engagement-trend", params),
  contentEngagement: (
    organizationId: string,
    contractId: number,
    params?: AnalyticsPageParams,
  ) =>
    contractResource(organizationId, contractId, "content-engagement", params),
  // queryify explodes arrays into repeated bare keys, as the generated client
  // serializes them.
  learnerProgress: (
    organizationId: string,
    contractId: number,
    params?: LearnerProgressParams,
  ) => contractResource(organizationId, contractId, "learner-progress", params),
  learners: (
    organizationId: string,
    contractId: number,
    params?: LearnersParams,
  ) => contractResource(organizationId, contractId, "learners", params),
  courseRuns: (
    organizationId: string,
    contractId: number,
    params?: AnalyticsPageParams,
  ) => contractResource(organizationId, contractId, "course-runs", params),
  needsAttention: (
    organizationId: string,
    contractId: number,
    params?: AnalyticsPageParams,
  ) => contractResource(organizationId, contractId, "needs-attention", params),
}

export { organizations, contracts }
