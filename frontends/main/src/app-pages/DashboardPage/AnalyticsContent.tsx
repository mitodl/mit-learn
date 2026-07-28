"use client"

import React from "react"
import Image from "next/image"
import { useQueries, useQuery } from "@tanstack/react-query"
import type { AxiosError } from "axios"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { Skeleton, Stack, styled, Typography } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { managerOrganizationQueries } from "api/mitxonline-hooks/organizations"
import { analyticsOrganizationQueries } from "api/analytics-hooks/organizations"
import { isAnalyticsConfigured } from "api/runtime"
import { matchOrganizationBySlug } from "@/common/utils"
import { ForbiddenError } from "@/common/errors"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { contractAdminView } from "@/common/urls"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import graduateLogo from "@/public/images/dashboard/graduate.png"
import ContractKpiCards from "./Analytics/ContractKpiCards"
import CoursePerformanceTable from "./Analytics/CoursePerformanceTable"
import EngagementTrendChart from "./Analytics/EngagementTrendChart"
import ProgramFunnelChart from "./Analytics/ProgramFunnelChart"
import SectionHeader from "./Analytics/SectionHeader"
import { getOrgUuid } from "./Analytics/orgUuid"

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
 * that no org is silently truncated at the default.
 */
const PAGE_SIZE = 200

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

type AnalyticsContentInternalProps = {
  orgSlug: string
}

const AnalyticsContentInternal: React.FC<AnalyticsContentInternalProps> = ({
  orgSlug,
}) => {
  const {
    data: managerOrgs,
    isLoading: isLoadingOrgs,
    isError: isOrgsError,
    error: orgsError,
  } = useQuery(managerOrganizationQueries.managerOrganizationsList())

  const org = managerOrgs?.find(matchOrganizationBySlug(orgSlug))
  const orgUuid = getOrgUuid(org)
  const analyticsAvailable = isAnalyticsConfigured() && !!orgUuid

  // One query per endpoint, each backed by its own materialized view with its
  // own refresh time, so sections load and report freshness independently.
  // Spelled out as a literal tuple rather than built with `.map` so useQueries
  // keeps each entry's own result type instead of widening them to `unknown`.
  const page = { limit: PAGE_SIZE }
  const [utilization, trend, courses, programs] = useQueries({
    queries: [
      {
        ...analyticsOrganizationQueries.contractUtilization(
          orgUuid ?? "",
          page,
        ),
        enabled: analyticsAvailable,
      },
      {
        ...analyticsOrganizationQueries.engagementTrend(orgUuid ?? "", page),
        enabled: analyticsAvailable,
      },
      {
        ...analyticsOrganizationQueries.enrollmentFunnel(orgUuid ?? "", page),
        enabled: analyticsAvailable,
      },
      {
        ...analyticsOrganizationQueries.programFunnel(orgUuid ?? "", page),
        enabled: analyticsAvailable,
      },
    ],
  })

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

  const firstContractSlug = org.contracts[0]?.slug

  const header = (
    <HeaderSection>
      <OrgDetailsContainer>
        <ImageContainer>
          <Image width={60} height={60} src={org.logo ?? graduateLogo} alt="" />
        </ImageContainer>
        <div>
          <OrgName component="h1">{org.name}</OrgName>
          <PageSubtitle>Analytics</PageSubtitle>
        </div>
      </OrgDetailsContainer>
      {firstContractSlug ? (
        <ButtonLink
          size="small"
          variant="bordered"
          href={contractAdminView(orgSlug, firstContractSlug)}
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
          {isAnalyticsConfigured()
            ? // The org record has no Keycloak organization UUID, which is
              // what the analytics API keys on. Nothing the manager can fix.
              "Analytics is not available for this organization yet. Please contact support if you expect to see data here."
            : "Analytics is not available in this environment."}
        </Notice>
      </Stack>
    )
  }

  const failed = [utilization, trend, courses, programs].some(
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
      </Section>
    </Stack>
  )
}

type AnalyticsContentProps = {
  orgSlug: string
}

const AnalyticsContent: React.FC<AnalyticsContentProps> = ({ orgSlug }) => {
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

  return <AnalyticsContentInternal orgSlug={orgSlug} />
}

export default AnalyticsContent
export type { AnalyticsContentProps }
