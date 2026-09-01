"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  keepPreviousData,
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query"
import type { AxiosError } from "axios"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { Skeleton, Stack, styled, Typography } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { managerOrganizationQueries } from "api/mitxonline-hooks/organizations"
import {
  analyticsContractQueries,
  analyticsOrganizationQueries,
} from "api/analytics-hooks/organizations"
import type {
  ContentEngagementDepth,
  ContractContentEngagementDepth,
  ContractMonthlyEngagementTrend,
  ContractUtilization,
  EnrollmentCompletionFunnel,
  MonthlyEngagementTrend,
  OrgAnalyticsResponse,
  ProgramFunnel,
} from "api/analytics-hooks/organizations"
import { isAnalyticsConfigured } from "api/runtime"
import { matchOrganizationBySlug } from "@/common/utils"
import { ForbiddenError } from "@/common/errors"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { contractAdminView, organizationAnalyticsView } from "@/common/urls"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import graduateLogo from "@/public/images/dashboard/graduate.png"
import ContentEngagementTable from "./Analytics/ContentEngagementTable"
import ContractKpiCards from "./Analytics/ContractKpiCards"
import CoursePerformanceTable from "./Analytics/CoursePerformanceTable"
import EngagementTrendChart from "./Analytics/EngagementTrendChart"
import ProgramFunnelChart from "./Analytics/ProgramFunnelChart"
import SectionHeader from "./Analytics/SectionHeader"
import SectionTruncation from "./Analytics/SectionTruncation"

/**
 * Org-scoped B2B analytics, the reporting half of the org-manager dashboard
 * whose other half is `ContractAdminPage` (seat administration). It reuses that
 * page's layout, header and table primitives so the two read as one product.
 *
 * # Access
 *
 * Authorization is the analytics API's job, not this component's: it checks
 * membership and org-manager status from the JWT that APISIX mints from the
 * session cookie, and answers 403 otherwise. What this component does is
 * resolve which org the caller means. It does so through MITx Online's
 * *manager* org list — the same source `ContractAdminPage` uses — so a learner
 * who is not a manager never gets as far as issuing an analytics request.
 */

/**
 * No page container here: the `/dashboard` layout already renders children
 * inside its own `Container` and sidebar grid column, so adding another would
 * double the padding and fight the grid. `ContractContent` does the same.
 */
const HeaderSection = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "24px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
}))

const OrgDetailsContainer = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "24px",
})

const ImageContainer = styled.div(({ theme }) => ({
  display: "flex",
  width: "60px",
  height: "60px",
  padding: "8px",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  overflow: "hidden",
  "> img": {
    width: "100%",
    height: "auto",
  },
}))

const OrgName = styled(Typography)(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.darkGray2,
})) as typeof Typography

const PageSubtitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const Section = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const Notice = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  backgroundColor: theme.custom.colors.lightGray1,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "24px",
})) as typeof Typography

/**
 * These views are small per org (contracts, programs, a couple of years of
 * months), but the API caps every list endpoint, so ask for a page big enough
 * that no org is truncated at the default.
 *
 * "Big enough" is not "always enough", though, which is why every section
 * compares what it rendered against the envelope's `total_count` and says so
 * when it is showing a subset — see `SectionTruncation`.
 */
const PAGE_SIZE = 200

/**
 * The analytics API's own `max_page_size`; it answers 422 above this. Caps what
 * "Show all" is allowed to ask for, so the button never issues a request the
 * API will reject.
 */
const MAX_PAGE_SIZE = 1000

type SectionKey = "utilization" | "trend" | "courses" | "programs" | "content"

/**
 * Note there is no 401/403 branch for the analytics queries themselves. The
 * browser query client (`makeBrowserQueryClient`) sets `throwOnError` for 400,
 * 401 and 403, so a caller the analytics API rejects never reaches an
 * `isError` branch here at all — the error is thrown to the route's error
 * boundary, which is where every other page's access denial is handled too.
 * Only the remaining statuses (5xx, network) surface as `isError` below, and
 * those mean "could not load", not "not allowed".
 */
const isForbidden = (error: unknown) => {
  const status = (error as AxiosError | null)?.response?.status
  return status === 401 || status === 403
}

/**
 * One section's query options, with the row type pinned but the query key
 * widened. Org- and contract-scoped factories build keys of different lengths;
 * this is what lets a single `useQuery` call accept either.
 */
type SectionQuery<RowT> = (page: {
  limit: number
}) => UseQueryOptions<OrgAnalyticsResponse<RowT>, Error>

type SectionQueries = {
  utilization: SectionQuery<ContractUtilization>
  trend: SectionQuery<MonthlyEngagementTrend>
  courses: SectionQuery<EnrollmentCompletionFunnel>
  programs: SectionQuery<ProgramFunnel>
  content: SectionQuery<ContentEngagementDepth>
}

/**
 * Widens only a factory's query-key type param, leaving its row type checked
 * against `SectionQueries`. Same trade `erase` makes in
 * `hooks/organizations/queries.test.ts`, narrowed to the key alone: wiring a
 * section to a factory whose row type doesn't match still fails to compile.
 */
const eraseKey = <RowT,>(
  // Nothing here reads the query key; only the row type above is meant to
  // stay checked against `SectionQueries`.
  factory: (page: { limit: number }) => UseQueryOptions<
    OrgAnalyticsResponse<RowT>,
    Error,
    OrgAnalyticsResponse<RowT>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >,
): SectionQuery<RowT> => factory

/**
 * `analyticsContractQueries.engagementTrend` returns
 * `ContractMonthlyEngagementTrend` -- the same columns as
 * `MonthlyEngagementTrend` plus the contract identity -- rather than
 * `MonthlyEngagementTrend` itself, the one section where the org- and
 * contract-scoped factories disagree on row type. `eraseKey` can't bridge
 * that the way it does for the other three sections: `UseQueryOptions` uses
 * the row type contravariantly in `select`, so a superset row type isn't
 * assignable through generics alone. `EngagementTrendChart` only reads the
 * shared columns, so erasing it here is safe.
 */
const eraseContractTrendRow = (
  // Nothing here reads the query key.
  factory: (page: { limit: number }) => UseQueryOptions<
    OrgAnalyticsResponse<ContractMonthlyEngagementTrend>,
    Error,
    OrgAnalyticsResponse<ContractMonthlyEngagementTrend>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >,
): SectionQuery<MonthlyEngagementTrend> =>
  factory as unknown as SectionQuery<MonthlyEngagementTrend>

/**
 * Same trade as `eraseContractTrendRow`, for the one other section where the
 * contract-scoped row (`ContractContentEngagementDepth`) is a superset of the
 * org-scoped one: it adds the contract identity that `ContentEngagementTable`
 * never reads.
 */
const eraseContractContentRow = (
  // Nothing here reads the query key.
  factory: (page: { limit: number }) => UseQueryOptions<
    OrgAnalyticsResponse<ContractContentEngagementDepth>,
    Error,
    OrgAnalyticsResponse<ContractContentEngagementDepth>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >,
): SectionQuery<ContentEngagementDepth> =>
  factory as unknown as SectionQuery<ContentEngagementDepth>

type AnalyticsContentInternalProps = {
  orgSlug: string
  /**
   * When present, the page is scoped to one contract: the same four sections,
   * narrowed. Absent, it stays org-wide. Both routes render this component.
   */
  contractSlug?: string
}

const AnalyticsContentInternal: React.FC<AnalyticsContentInternalProps> = ({
  orgSlug,
  contractSlug,
}) => {
  const {
    data: managerOrgs,
    isLoading: isLoadingOrgs,
    isError: isOrgsError,
    error: orgsError,
  } = useQuery(managerOrganizationQueries.managerOrganizationsList())

  const org = managerOrgs?.find(matchOrganizationBySlug(orgSlug))
  // The Keycloak organization UUID, which is what the analytics API keys every
  // org endpoint on (see mitodl/ol-analytics-api#13). It is null on orgs whose
  // MITx Online record predates the field, and absent altogether against a
  // deploy that predates mitodl/mitxonline#3789 — both must read as "analytics
  // unavailable" rather than a request with `undefined` in the path.
  const orgUuid = org?.sso_organization_id ?? null
  // MITx Online's contract id, resolved from the slug the route carries -- the
  // same lookup ContractAdminPage does. The analytics API filters on this id,
  // never on the slug, and never on the warehouse's `contract_pk` surrogate.
  const contract = contractSlug
    ? org?.contracts.find((c) => c.slug === contractSlug)
    : undefined
  const contractId = contract ? String(contract.id) : null
  // A contract route whose slug matches nothing in this org is as unavailable
  // as a missing org UUID: better an empty state than a request with
  // `undefined` in the path, which the API would answer with a 403 for a
  // contract that simply does not exist.
  const analyticsAvailable =
    isAnalyticsConfigured() && !!orgUuid && (!contractSlug || !!contractId)
  // The narrower case of the above: the org itself is fine, only the
  // contract slug doesn't resolve (a stale or mistyped link). Kept distinct
  // from `analyticsAvailable` so the notice can point at the broken link
  // instead of telling a manager on a perfectly valid org to contact support.
  const contractUnresolved = !!contractSlug && !!orgUuid && !contractId

  // Per-section page size. Raised only by that section's "Show all", so
  // expanding a truncated course table never refetches the other three.
  const [limits, setLimits] = React.useState<Record<SectionKey, number>>({
    utilization: PAGE_SIZE,
    trend: PAGE_SIZE,
    courses: PAGE_SIZE,
    programs: PAGE_SIZE,
    content: PAGE_SIZE,
  })

  // One query per endpoint, each backed by its own materialized view with its
  // own refresh time, so sections load and report freshness independently.
  //
  // Separate `useQuery` calls rather than one `useQueries`, which is what this
  // was originally. `placeholderData: keepPreviousData` is silently inert under
  // `useQueries` here — on a limit change the result went straight to
  // `data: undefined`, so the section a manager had just asked to expand blanked
  // back to its skeleton, which is exactly what the option was there to prevent.
  // It behaves as documented on `useQuery` (as it does on ContractAdminPage).
  // The count is fixed and the order never changes, so this is hook-safe.
  //
  // Org- and contract-scoped queries return the identical envelope and row
  // shapes, so the scope is chosen once here and nothing below this line
  // changes with it. The hook count and order stay fixed either way.
  //
  // The `eraseKey` wrap on each factory is load-bearing. The two branches
  // build query keys of different lengths (contract keys carry two more
  // segments) and `queryOptions` is invariant in the key type, so the
  // inferred union leaves `useQuery` unable to pick an overload. Widening
  // just the key -- rather than the whole options object -- keeps each
  // section's row type checked against `SectionQueries`.
  const scoped = React.useMemo(() => {
    const orgId = orgUuid ?? ""
    return contractId
      ? {
          utilization: eraseKey<ContractUtilization>((page) =>
            analyticsContractQueries.contractUtilization(
              orgId,
              contractId,
              page,
            ),
          ),
          trend: eraseContractTrendRow((page) =>
            analyticsContractQueries.engagementTrend(orgId, contractId, page),
          ),
          courses: eraseKey<EnrollmentCompletionFunnel>((page) =>
            analyticsContractQueries.enrollmentFunnel(orgId, contractId, page),
          ),
          programs: eraseKey<ProgramFunnel>((page) =>
            analyticsContractQueries.programFunnel(orgId, contractId, page),
          ),
          content: eraseContractContentRow((page) =>
            analyticsContractQueries.contentEngagement(orgId, contractId, page),
          ),
        }
      : {
          utilization: eraseKey<ContractUtilization>((page) =>
            analyticsOrganizationQueries.contractUtilization(orgId, page),
          ),
          trend: eraseKey<MonthlyEngagementTrend>((page) =>
            analyticsOrganizationQueries.engagementTrend(orgId, page),
          ),
          courses: eraseKey<EnrollmentCompletionFunnel>((page) =>
            analyticsOrganizationQueries.enrollmentFunnel(orgId, page),
          ),
          programs: eraseKey<ProgramFunnel>((page) =>
            analyticsOrganizationQueries.programFunnel(orgId, page),
          ),
          content: eraseKey<ContentEngagementDepth>((page) =>
            analyticsOrganizationQueries.contentEngagement(orgId, page),
          ),
        }
  }, [orgUuid, contractId]) satisfies SectionQueries

  const utilization = useQuery({
    ...scoped.utilization({ limit: limits.utilization }),
    enabled: analyticsAvailable,
    placeholderData: keepPreviousData,
  })
  const trend = useQuery({
    ...scoped.trend({ limit: limits.trend }),
    enabled: analyticsAvailable,
    placeholderData: keepPreviousData,
  })
  const courses = useQuery({
    ...scoped.courses({ limit: limits.courses }),
    enabled: analyticsAvailable,
    placeholderData: keepPreviousData,
  })
  const programs = useQuery({
    ...scoped.programs({ limit: limits.programs }),
    enabled: analyticsAvailable,
    placeholderData: keepPreviousData,
  })
  const content = useQuery({
    ...scoped.content({ limit: limits.content }),
    enabled: analyticsAvailable,
    placeholderData: keepPreviousData,
  })

  /**
   * The truncation footer for one section, or null when it is showing
   * everything. "Show all" asks for the whole result set in a single page,
   * bounded by what the API will serve — beyond that the message stands alone,
   * since a button that cannot deliver the rest would be worse than none.
   */
  const truncation = (
    query: {
      data?: { total_count: number; data: unknown[] }
      isPlaceholderData: boolean
    },
    key: SectionKey,
  ) => {
    if (!query.data) return null
    const { total_count: total } = query.data
    const shown = query.data.data.length
    const nextLimit = Math.min(total, MAX_PAGE_SIZE)
    return (
      <SectionTruncation
        shown={shown}
        total={total}
        // `isPlaceholderData` is precisely "a differently-keyed query is in
        // flight and these rows are the previous ones" — which is the state a
        // manager cannot otherwise perceive, since the table does not blank.
        isExpanding={query.isPlaceholderData}
        // Offer the button only when it would actually ask for more than we
        // already did. Two ways it would not: the section is at the API's cap,
        // or it already requested `total` rows and got back fewer because the
        // API applies its LIMIT before the anonymity floor drops sub-floor rows
        // — so a page of `total` can still come back short, permanently. Either
        // way the message stands alone rather than offering a no-op click.
        canShowAll={nextLimit > limits[key]}
        onShowAll={() =>
          setLimits((current) => ({ ...current, [key]: nextLimit }))
        }
      />
    )
  }

  if (isLoadingOrgs) {
    return <Skeleton width="100%" height="128px" />
  }

  if (isOrgsError) {
    return isForbidden(orgsError) ? (
      <ErrorContent title="Access denied" timSays="403" />
    ) : (
      <ErrorContent title="Something went wrong" timSays="Oops!" />
    )
  }

  // Not in the manager org list means not an org manager for this org — the
  // same 403 the contract admin page gives, decided before any analytics call.
  if (!org) {
    return <ErrorContent title="Access denied" timSays="403" />
  }

  // On a contract-scoped page this must be the contract being viewed, not the
  // org's first one, or "Manage seats" silently sends the manager to a
  // different contract's admin page. And when that contract fails to
  // resolve, it must stay undefined rather than falling back to the org's
  // first contract, or the unresolved-link notice renders a "Manage seats"
  // button pointing at an unrelated contract.
  const manageSeatsSlug = contractSlug ? contract?.slug : org.contracts[0]?.slug

  const header = (
    <HeaderSection>
      <OrgDetailsContainer>
        <ImageContainer>
          <Image width={60} height={60} src={org.logo ?? graduateLogo} alt="" />
        </ImageContainer>
        <div>
          <OrgName component="h1">{org.name}</OrgName>
          <PageSubtitle>
            {contract ? `Analytics · ${contract.name}` : "Analytics"}
          </PageSubtitle>
        </div>
      </OrgDetailsContainer>
      {manageSeatsSlug ? (
        <ButtonLink
          size="small"
          variant="bordered"
          href={contractAdminView(orgSlug, manageSeatsSlug)}
        >
          Manage seats
        </ButtonLink>
      ) : null}
    </HeaderSection>
  )

  if (!analyticsAvailable) {
    return (
      <Stack gap="24px">
        {header}
        <Notice>
          {contractUnresolved ? (
            <>
              This contract link could not be found for {org.name}. Try{" "}
              <Link href={organizationAnalyticsView(orgSlug)}>
                organization-wide analytics
              </Link>{" "}
              instead.
            </>
          ) : isAnalyticsConfigured() ? (
            // The org record has no Keycloak organization UUID, which is
            // what the analytics API keys on. Nothing the manager can fix.
            "Analytics is not available for this organization yet. Please contact support if you expect to see data here."
          ) : (
            "Analytics is not available in this environment."
          )}
        </Notice>
      </Stack>
    )
  }

  const failed = [utilization, trend, courses, programs, content].some(
    (query) => query.isError,
  )

  return (
    <Stack gap="40px" width="100%">
      {header}

      {failed ? (
        <Notice>
          Some analytics could not be loaded. The figures below may be
          incomplete.
        </Notice>
      ) : null}

      <Section>
        <SectionHeader
          title="Contract utilization"
          description="Seats consumed and learner outcomes for each contract."
          asOf={utilization.data?.as_of}
          isLoading={utilization.isPending}
          isError={utilization.isError}
        />
        <ContractKpiCards
          rows={utilization.data?.data}
          isLoading={utilization.isPending}
          isError={utilization.isError}
        />
        {truncation(utilization, "utilization")}
      </Section>

      <Section>
        <SectionHeader
          title="Monthly engagement"
          description="Distinct learners active, newly enrolled, and certified each month."
          asOf={trend.data?.as_of}
          isLoading={trend.isPending}
          isError={trend.isError}
        />
        <EngagementTrendChart
          rows={trend.data?.data}
          isLoading={trend.isPending}
          isError={trend.isError}
        />
        {truncation(trend, "trend")}
      </Section>

      <Section>
        <SectionHeader
          title="Course performance"
          description="Enrollment, activity and completion for each course run."
          asOf={courses.data?.as_of}
          isLoading={courses.isPending}
          isError={courses.isError}
        />
        <CoursePerformanceTable
          rows={courses.data?.data}
          isLoading={courses.isPending}
          isError={courses.isError}
        />
        {truncation(courses, "courses")}
      </Section>

      <Section>
        <SectionHeader
          title="Program funnel"
          description="How far learners progress through each program."
          asOf={programs.data?.as_of}
          isLoading={programs.isPending}
          isError={programs.isError}
        />
        <ProgramFunnelChart
          rows={programs.data?.data}
          isLoading={programs.isPending}
          isError={programs.isError}
        />
        {truncation(programs, "programs")}
      </Section>

      <Section>
        <SectionHeader
          title="Content engagement"
          description="How deeply learners engage with videos, problems and the chatbot in each course run."
          asOf={content.data?.as_of}
          isLoading={content.isPending}
          isError={content.isError}
        />
        <ContentEngagementTable
          rows={content.data?.data}
          isLoading={content.isPending}
          isError={content.isError}
        />
        {truncation(content, "content")}
      </Section>
    </Stack>
  )
}

type AnalyticsContentProps = {
  orgSlug: string
  contractSlug?: string
}

const AnalyticsContent: React.FC<AnalyticsContentProps> = ({
  orgSlug,
  contractSlug,
}) => {
  const flagEnabled = useFeatureFlagEnabled(FeatureFlags.B2BAnalyticsDashboard)
  const flagsLoaded = useFeatureFlagsLoaded()

  // The whole page is behind the flag, so wait for the real value rather than
  // 403-ing on a bootstrapped `false` — same reasoning as ContractAdminPage.
  if (!flagsLoaded) {
    return <Skeleton width="100%" height="128px" />
  }

  if (!flagEnabled) {
    throw new ForbiddenError("Not enabled.")
  }

  return (
    <AnalyticsContentInternal orgSlug={orgSlug} contractSlug={contractSlug} />
  )
}

export default AnalyticsContent
export type { AnalyticsContentProps }
