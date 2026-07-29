import { queryOptions } from "@tanstack/react-query"
import { analyticsOrganizationsApi } from "../../clients"
import type { AnalyticsPageParams } from "../../types"

/**
 * `orgId` in every key is the Keycloak organization UUID — see
 * `analyticsOrganizationsApi`. Keys are namespaced under "analytics" so the
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
        analyticsOrganizationsApi
          .contractUtilization(orgId, page, signal)
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
        analyticsOrganizationsApi
          .enrollmentFunnel(orgId, page, signal)
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
        analyticsOrganizationsApi
          .engagementTrend(orgId, page, signal)
          .then((res) => res.data),
    }),

  programFunnel: (orgId: string, page?: AnalyticsPageParams) =>
    queryOptions({
      queryKey: analyticsOrganizationKeys.resource(
        orgId,
        "program-funnel",
        page,
      ),
      staleTime: ANALYTICS_STALE_TIME,
      queryFn: async ({ signal }) =>
        analyticsOrganizationsApi
          .programFunnel(orgId, page, signal)
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
        analyticsOrganizationsApi
          .contentEngagement(orgId, page, signal)
          .then((res) => res.data),
    }),
}

export { analyticsOrganizationQueries, analyticsOrganizationKeys }
