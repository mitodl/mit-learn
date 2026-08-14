import type { AxiosResponse } from "axios"
import axiosInstance from "./axios"
import type {
  AnalyticsPageParams,
  ContentEngagementDepth,
  ContractContentEngagementDepth,
  ContractMonthlyEngagementTrend,
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

/**
 * `contractId` is MITx Online's `ContractPage.page_ptr_id` — the same value the
 * manager dashboard puts in its own URLs, and what the analytics API filters
 * on. NOT the contract slug the MIT Learn route carries, and NOT the
 * warehouse's `contract_pk` surrogate; resolve the slug to an id from the
 * org's `contracts` list before calling any of these.
 *
 * The org segment stays in the path even though a contract id identifies a
 * contract on its own: the API filters on both, so that a manager of one org
 * cannot read another's contract by naming it.
 */
const contractRoot = (organizationId: string, contractId: string) =>
  `${orgRoot(organizationId)}/contracts/${encodeURIComponent(contractId)}`

const getContractResource = <RowT>(
  organizationId: string,
  contractId: string,
  resource: string,
  page: AnalyticsPageParams | undefined,
  signal: AbortSignal | undefined,
): Promise<AxiosResponse<OrgAnalyticsResponse<RowT>>> =>
  axiosInstance.get<OrgAnalyticsResponse<RowT>>(
    `${contractRoot(organizationId, contractId)}/${resource}`,
    { params: page, signal },
  )

/**
 * The contract-scoped half of the same five endpoints, mirroring MITx Online's
 * manager dashboard (which nests contracts under an organization). Same
 * envelope, same paging, same suppression — only the scope differs.
 *
 * Two of the five read materialized views that exist only at contract grain
 * (engagement-trend, content-engagement); the rest read the same views as the
 * org endpoints, filtered down.
 */
const analyticsContractsApi = {
  contractUtilization: (
    organizationId: string,
    contractId: string,
    page?: AnalyticsPageParams,
    signal?: AbortSignal,
  ) =>
    getContractResource<ContractUtilization>(
      organizationId,
      contractId,
      "contract-utilization",
      page,
      signal,
    ),

  enrollmentFunnel: (
    organizationId: string,
    contractId: string,
    page?: AnalyticsPageParams,
    signal?: AbortSignal,
  ) =>
    getContractResource<EnrollmentCompletionFunnel>(
      organizationId,
      contractId,
      "enrollment-funnel",
      page,
      signal,
    ),

  engagementTrend: (
    organizationId: string,
    contractId: string,
    page?: AnalyticsPageParams,
    signal?: AbortSignal,
  ) =>
    getContractResource<ContractMonthlyEngagementTrend>(
      organizationId,
      contractId,
      "engagement-trend",
      page,
      signal,
    ),

  programFunnel: (
    organizationId: string,
    contractId: string,
    page?: AnalyticsPageParams,
    signal?: AbortSignal,
  ) =>
    getContractResource<ProgramFunnel>(
      organizationId,
      contractId,
      "program-funnel",
      page,
      signal,
    ),

  contentEngagement: (
    organizationId: string,
    contractId: string,
    page?: AnalyticsPageParams,
    signal?: AbortSignal,
  ) =>
    getContractResource<ContractContentEngagementDepth>(
      organizationId,
      contractId,
      "content-engagement",
      page,
      signal,
    ),
}

export { analyticsOrganizationsApi, analyticsContractsApi, B2B_DASHBOARD_ROOT }
