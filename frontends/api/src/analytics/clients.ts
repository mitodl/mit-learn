import type { AxiosResponse } from "axios"
import axiosInstance from "./axios"
import type {
  AnalyticsPageParams,
  ContentEngagementDepth,
  ContractUtilization,
  EnrollmentCompletionFunnel,
  MonthlyEngagementTrend,
  OrgAnalyticsResponse,
  ProgramFunnel,
} from "./types"

/**
 * The b2b_dashboard tenant is mounted at this path by `ol-analytics-api`'s
 * root ASGI app (`main.py`'s tenant registry). The configured axios `baseURL`
 * is the API host, so every path here is relative to it.
 */
const B2B_DASHBOARD_ROOT = "/api/v1/analytics"

/**
 * `organizationId` is the **Keycloak organization UUID** (`sso_organization_id`),
 * not the org slug and not MITx Online's numeric org id. It is the only
 * identifier that is stable across the JWT, MITx Online and StarRocks, so the
 * analytics API keys every org endpoint on it — see mitodl/ol-analytics-api#13.
 */
const orgRoot = (organizationId: string) =>
  `${B2B_DASHBOARD_ROOT}/organizations/${encodeURIComponent(organizationId)}`

const getOrgResource = <RowT>(
  organizationId: string,
  resource: string,
  page: AnalyticsPageParams | undefined,
  signal: AbortSignal | undefined,
): Promise<AxiosResponse<OrgAnalyticsResponse<RowT>>> =>
  axiosInstance.get<OrgAnalyticsResponse<RowT>>(
    `${orgRoot(organizationId)}/${resource}`,
    { params: page, signal },
  )

/**
 * One method per org-scoped endpoint of the analytics API's b2b_dashboard
 * tenant. Thin by design — paging and the response envelope are the only
 * shared concerns, and both live in `getOrgResource`.
 */
const analyticsOrganizationsApi = {
  contractUtilization: (
    organizationId: string,
    page?: AnalyticsPageParams,
    signal?: AbortSignal,
  ) =>
    getOrgResource<ContractUtilization>(
      organizationId,
      "contract-utilization",
      page,
      signal,
    ),

  enrollmentFunnel: (
    organizationId: string,
    page?: AnalyticsPageParams,
    signal?: AbortSignal,
  ) =>
    getOrgResource<EnrollmentCompletionFunnel>(
      organizationId,
      "enrollment-funnel",
      page,
      signal,
    ),

  engagementTrend: (
    organizationId: string,
    page?: AnalyticsPageParams,
    signal?: AbortSignal,
  ) =>
    getOrgResource<MonthlyEngagementTrend>(
      organizationId,
      "engagement-trend",
      page,
      signal,
    ),

  programFunnel: (
    organizationId: string,
    page?: AnalyticsPageParams,
    signal?: AbortSignal,
  ) =>
    getOrgResource<ProgramFunnel>(
      organizationId,
      "program-funnel",
      page,
      signal,
    ),

  contentEngagement: (
    organizationId: string,
    page?: AnalyticsPageParams,
    signal?: AbortSignal,
  ) =>
    getOrgResource<ContentEngagementDepth>(
      organizationId,
      "content-engagement",
      page,
      signal,
    ),
}

export { analyticsOrganizationsApi, B2B_DASHBOARD_ROOT }
