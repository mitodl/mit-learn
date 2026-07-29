import { queryify } from "ol-test-utilities"
import analyticsAxios from "../axios"
import { B2B_DASHBOARD_ROOT } from "../clients"
import type { AnalyticsPageParams } from "../types"

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

const organizations = {
  contractUtilization: (organizationId: string, params?: AnalyticsPageParams) =>
    orgResource(organizationId, "contract-utilization", params),
  enrollmentFunnel: (organizationId: string, params?: AnalyticsPageParams) =>
    orgResource(organizationId, "enrollment-funnel", params),
  engagementTrend: (organizationId: string, params?: AnalyticsPageParams) =>
    orgResource(organizationId, "engagement-trend", params),
  programFunnel: (organizationId: string, params?: AnalyticsPageParams) =>
    orgResource(organizationId, "program-funnel", params),
  contentEngagement: (organizationId: string, params?: AnalyticsPageParams) =>
    orgResource(organizationId, "content-engagement", params),
}

export { organizations }
