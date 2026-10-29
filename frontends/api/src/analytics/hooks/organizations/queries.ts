import { queryOptions } from "@tanstack/react-query"
import type {
  LearnersApiLearnersListRequest,
  LearnersApiLearnersProgressRetrieveRequest,
  OrganizationsApiOrganizationsContractUtilizationRetrieveRequest,
  OrgAnalyticsResponseContractUtilization,
} from "@mitodl/ol-analytics-dashboard-api-axios"
import {
  contractsApi,
  learnersApi,
  needsAttentionApi,
  organizationsApi,
} from "../../clients"

/**
 * LIMIT/OFFSET paging, shared by every multi-row endpoint. The API caps `limit`
 * at its own `max_page_size` and rejects anything larger with a 422.
 */
type AnalyticsPageParams = Omit<
  OrganizationsApiOrganizationsContractUtilizationRetrieveRequest,
  "organization_id"
>

/**
 * The org-scope envelope, generic over its row type. The generated client
 * declares one envelope per row type (`OrgAnalyticsResponseContractUtilization`,
 * ...), all with the same fields; this is that shape with `data` widened, so a
 * component can take any section's response.
 *
 * `as_of` is the last refresh time of the single materialized view backing
 * the endpoint, so it is per-section rather than per-page, and `null` until
 * that view has refreshed for the first time. `total_count` is the row count
 * across every page, already net of the anonymity floor; `data.length` alone
 * cannot distinguish a complete result from one truncated at the page cap.
 */
type OrgAnalyticsResponse<RowT> = Omit<
  OrgAnalyticsResponseContractUtilization,
  "data"
> & { data: RowT[] }

type ContractRequestIds = "organization_id" | "contract_id"

/**
 * `completion_status` additionally takes `unknown` to select rows whose
 * outcomes are withheld. Those rows match NEITHER value of `needs_attention`,
 * mirroring the consent gating on the row field, so a request that sets it
 * never returns them.
 */
type LearnerProgressParams = Omit<
  LearnersApiLearnersProgressRetrieveRequest,
  ContractRequestIds
>

/** `limit` and `offset` count learners, not enrollments; the API caps `limit` at 25. */
type LearnersParams = Omit<LearnersApiLearnersListRequest, ContractRequestIds>

/**
 * `orgId` in every key is the Keycloak organization UUID
 * (`sso_organization_id`), not the org slug and not MITx Online's numeric org
 * id. It is the only identifier that is stable across the JWT, MITx Online and
 * StarRocks, so the analytics API keys every org endpoint on it (see
 * mitodl/ol-analytics-api#13). Keys are namespaced under "analytics" so the
 * whole dashboard can be invalidated without touching mitxonline or learn
 * queries.
 */
const analyticsOrganizationKeys = {
  root: ["analytics", "organizations"] as const,
  organization: (orgId: string) =>
    [...analyticsOrganizationKeys.root, orgId] as const,
  resource: (orgId: string, resource: string, page?: AnalyticsPageParams) =>
    [...analyticsOrganizationKeys.organization(orgId), resource, page] as const,
}

/**
 * The materialized views behind these endpoints refresh on a schedule measured
 * in hours, so refetching on every window focus only costs StarRocks queries
 * without ever changing what the manager sees. Freshness is communicated by the
 * `as_of` in each response instead.
 */
const ANALYTICS_STALE_TIME = 5 * 60 * 1000

/** See `analyticsContractQueries.learnerProgress`. */
const LEARNER_PROGRESS_STALE_TIME = 60 * 1000

const analyticsOrganizationQueries = {
  contractUtilization: (orgId: string, page?: AnalyticsPageParams) =>
    queryOptions({
      queryKey: analyticsOrganizationKeys.resource(
        orgId,
        "contract-utilization",
        page,
      ),
      staleTime: ANALYTICS_STALE_TIME,
      queryFn: async ({ signal }) =>
        organizationsApi
          .organizationsContractUtilizationRetrieve(
            { organization_id: orgId, ...page },
            { signal },
          )
          .then((res) => res.data),
    }),

  enrollmentFunnel: (orgId: string, page?: AnalyticsPageParams) =>
    queryOptions({
      queryKey: analyticsOrganizationKeys.resource(
        orgId,
        "enrollment-funnel",
        page,
      ),
      staleTime: ANALYTICS_STALE_TIME,
      queryFn: async ({ signal }) =>
        organizationsApi
          .organizationsEnrollmentFunnelRetrieve(
            { organization_id: orgId, ...page },
            { signal },
          )
          .then((res) => res.data),
    }),

  engagementTrend: (orgId: string, page?: AnalyticsPageParams) =>
    queryOptions({
      queryKey: analyticsOrganizationKeys.resource(
        orgId,
        "engagement-trend",
        page,
      ),
      staleTime: ANALYTICS_STALE_TIME,
      queryFn: async ({ signal }) =>
        organizationsApi
          .organizationsEngagementTrendRetrieve(
            { organization_id: orgId, ...page },
            { signal },
          )
          .then((res) => res.data),
    }),

  contentEngagement: (orgId: string, page?: AnalyticsPageParams) =>
    queryOptions({
      queryKey: analyticsOrganizationKeys.resource(
        orgId,
        "content-engagement",
        page,
      ),
      staleTime: ANALYTICS_STALE_TIME,
      queryFn: async ({ signal }) =>
        organizationsApi
          .organizationsContentEngagementRetrieve(
            { organization_id: orgId, ...page },
            { signal },
          )
          .then((res) => res.data),
    }),
}

/**
 * Contract-scoped keys nest under the org's, so invalidating an organization
 * drops its contracts' cached sections too — they are views of the same
 * underlying data and can never be stale independently.
 *
 * `contractId` is MITx Online's `ContractPage.page_ptr_id`, the same value the
 * manager dashboard puts in its own URLs and what the analytics API filters
 * on. NOT the contract slug the MIT Learn route carries, and NOT the
 * warehouse's `contract_pk` surrogate; resolve the slug to an id from the
 * org's `contracts` list first. The org stays in the path even though a
 * contract id is unique on its own: the API filters on both, so a manager of
 * one org cannot read another's contract by naming it.
 */
const analyticsContractKeys = {
  contract: (orgId: string, contractId: number) =>
    [
      ...analyticsOrganizationKeys.organization(orgId),
      "contracts",
      contractId,
    ] as const,
  resource: (
    orgId: string,
    contractId: number,
    resource: string,
    page?: AnalyticsPageParams,
  ) =>
    [
      ...analyticsContractKeys.contract(orgId, contractId),
      resource,
      page,
    ] as const,
  /**
   * Its own builder rather than widening `resource`, whose `page` is typed as
   * `AnalyticsPageParams` and is relied on by the four sections above.
   */
  learnerProgress: (
    orgId: string,
    contractId: number,
    params?: LearnerProgressParams,
  ) =>
    [
      ...analyticsContractKeys.contract(orgId, contractId),
      "learner-progress",
      params,
    ] as const,
}

const analyticsContractQueries = {
  contractUtilization: (
    orgId: string,
    contractId: number,
    page?: AnalyticsPageParams,
  ) =>
    queryOptions({
      queryKey: analyticsContractKeys.resource(
        orgId,
        contractId,
        "contract-utilization",
        page,
      ),
      staleTime: ANALYTICS_STALE_TIME,
      queryFn: async ({ signal }) =>
        contractsApi
          .contractsContractUtilizationRetrieve(
            { organization_id: orgId, contract_id: contractId, ...page },
            { signal },
          )
          .then((res) => res.data),
    }),

  enrollmentFunnel: (
    orgId: string,
    contractId: number,
    page?: AnalyticsPageParams,
  ) =>
    queryOptions({
      queryKey: analyticsContractKeys.resource(
        orgId,
        contractId,
        "enrollment-funnel",
        page,
      ),
      staleTime: ANALYTICS_STALE_TIME,
      queryFn: async ({ signal }) =>
        contractsApi
          .contractsEnrollmentFunnelRetrieve(
            { organization_id: orgId, contract_id: contractId, ...page },
            { signal },
          )
          .then((res) => res.data),
    }),

  engagementTrend: (
    orgId: string,
    contractId: number,
    page?: AnalyticsPageParams,
  ) =>
    queryOptions({
      queryKey: analyticsContractKeys.resource(
        orgId,
        contractId,
        "engagement-trend",
        page,
      ),
      staleTime: ANALYTICS_STALE_TIME,
      queryFn: async ({ signal }) =>
        contractsApi
          .contractsEngagementTrendRetrieve(
            { organization_id: orgId, contract_id: contractId, ...page },
            { signal },
          )
          .then((res) => res.data),
    }),

  contentEngagement: (
    orgId: string,
    contractId: number,
    page?: AnalyticsPageParams,
  ) =>
    queryOptions({
      queryKey: analyticsContractKeys.resource(
        orgId,
        contractId,
        "content-engagement",
        page,
      ),
      staleTime: ANALYTICS_STALE_TIME,
      queryFn: async ({ signal }) =>
        contractsApi
          .contractsContentEngagementRetrieve(
            { organization_id: orgId, contract_id: contractId, ...page },
            { signal },
          )
          .then((res) => res.data),
    }),

  /**
   * Shorter-lived than the sections above: this is the enrollment and consent
   * state a manager acts on directly, not an hours-cadence rollup, so a stale
   * page here is more costly than the extra query.
   */
  learnerProgress: (
    orgId: string,
    contractId: number,
    params?: LearnerProgressParams,
  ) =>
    queryOptions({
      queryKey: analyticsContractKeys.learnerProgress(
        orgId,
        contractId,
        params,
      ),
      staleTime: LEARNER_PROGRESS_STALE_TIME,
      queryFn: async ({ signal }) =>
        learnersApi
          .learnersProgressRetrieve(
            { organization_id: orgId, contract_id: contractId, ...params },
            { signal },
          )
          .then((res) => res.data),
    }),

  /**
   * One page of learners, each with all of their enrollments. `params.limit`
   * and `params.offset` count learners.
   */
  learners: (orgId: string, contractId: number, params?: LearnersParams) =>
    queryOptions({
      queryKey: [
        ...analyticsContractKeys.contract(orgId, contractId),
        "learners",
        params,
      ] as const,
      staleTime: LEARNER_PROGRESS_STALE_TIME,
      queryFn: async ({ signal }) =>
        learnersApi
          .learnersList(
            { organization_id: orgId, contract_id: contractId, ...params },
            { signal },
          )
          .then((res) => res.data),
    }),

  /**
   * The module filter's options. Kept on the shared five-minute
   * `ANALYTICS_STALE_TIME` rather than `learnerProgress`'s shorter one: a
   * contract's set of course runs changes when the contract does, not as
   * learners move through it. Five minutes is still short enough that a
   * consumer has to expect a mid-session refetch.
   */
  courseRuns: (orgId: string, contractId: number, page?: AnalyticsPageParams) =>
    queryOptions({
      queryKey: analyticsContractKeys.resource(
        orgId,
        contractId,
        "course-runs",
        page,
      ),
      staleTime: ANALYTICS_STALE_TIME,
      queryFn: async ({ signal }) =>
        learnersApi
          .learnersCourseRunsRetrieve(
            { organization_id: orgId, contract_id: contractId, ...page },
            { signal },
          )
          .then((res) => res.data),
    }),

  /**
   * On `learnerProgress`'s stale time, not the rollups': it is computed from
   * the same rows at query time, and the count should not lag the directory a
   * manager clicks through to.
   */
  needsAttention: (orgId: string, contractId: number) =>
    queryOptions({
      queryKey: analyticsContractKeys.resource(
        orgId,
        contractId,
        "needs-attention",
      ),
      staleTime: LEARNER_PROGRESS_STALE_TIME,
      queryFn: async ({ signal }) =>
        needsAttentionApi
          .contractsNeedsAttentionRetrieve(
            { organization_id: orgId, contract_id: contractId },
            { signal },
          )
          .then((res) => res.data),
    }),
}

export type {
  AnalyticsPageParams,
  LearnerProgressParams,
  LearnersParams,
  OrgAnalyticsResponse,
}
export {
  analyticsOrganizationQueries,
  analyticsOrganizationKeys,
  analyticsContractQueries,
  analyticsContractKeys,
}
