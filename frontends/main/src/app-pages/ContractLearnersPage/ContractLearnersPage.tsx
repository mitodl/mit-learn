"use client"

import React, { useCallback, useMemo, useRef, useState } from "react"
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import Image from "next/image"
import { RiCheckLine } from "@remixicon/react"
import {
  Container,
  SearchInput,
  SimpleSelectField,
  Skeleton,
  Stack,
  styled,
  Typography,
} from "ol-components"
import { Alert, Button, Checkbox, VisuallyHidden } from "@mitodl/smoot-design"
import {
  analyticsContractQueries,
  type LearnerWithEnrollments,
} from "api/analytics-hooks/organizations"
import { managerOrganizationQueries } from "api/mitxonline-hooks/organizations"
import { isAnalyticsConfigured } from "api/runtime"
import { AriaDisabledButtonWrapper } from "@/components/B2BTable/B2BTable"
import { matchOrganizationBySlug } from "@/common/utils"
import {
  ForbiddenError,
  isAnalyticsNotLoaded,
  isForbiddenResponse,
} from "@/common/errors"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { useFeatureFlag } from "@/common/useFeatureFlag"
import graduateLogo from "@/public/images/dashboard/graduate.png"
import ContractManagerNav from "@/components/ContractManagerNav/ContractManagerNav"
import SectionHeader, {
  SectionFreshness,
} from "../DashboardPage/Analytics/SectionHeader"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import {
  buildGridCsv,
  gridColumns,
  gridLearnersQuery,
  GRID_PAGE_SIZE,
  ProgressGrid,
} from "./ProgressGrid"
import { completionStatusFilter } from "@/common/urls"
import { ALL, SEARCH_MAX_LENGTH, useLearnerFilters } from "./useLearnerFilters"

/**
 * The B2B learner directory: one row per learner, one column per course run
 * under a contract.
 *
 * Routed outside `/dashboard` (see `CONTRACT_LEARNERS_VIEW`) so it gets no
 * sidebar and can use the full width this table needs.
 */

const Page = styled(Container)(({ theme }) => ({
  maxWidth: "1400px",
  padding: "40px 24px",
  [theme.breakpoints.down("md")]: {
    padding: "24px 16px",
  },
}))

const HeaderSection = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "24px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "stretch",
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

const ExportWrapper = styled(AriaDisabledButtonWrapper)(({ theme }) => ({
  flexShrink: 0,
  [theme.breakpoints.down("md")]: {
    "> button": { width: "100%" },
  },
}))

const ResultsSection = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const AsOfRow = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  [theme.breakpoints.down("md")]: {
    justifyContent: "flex-start",
  },
}))

const ControlsRow = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const ControlsRight = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  gap: "12px",
  flexWrap: "wrap",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
  },
}))

const StyledSearchInput = styled(SearchInput)(({ theme }) => ({
  minWidth: "280px",
  [theme.breakpoints.down("md")]: { minWidth: "auto", width: "100%" },
}))

const FilterField = styled(SimpleSelectField)(({ theme }) => ({
  "& .MuiSelect-root": {
    width: "280px",
  },
  [theme.breakpoints.down("md")]: {
    width: "100%",
    "& .MuiSelect-root": {
      width: "100%",
    },
  },
}))

const SelectedValue = styled.span({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
})

const FilterSelect: React.FC<React.ComponentProps<typeof FilterField>> = ({
  options,
  ...props
}) => (
  <FilterField
    options={options}
    {...props}
    renderValue={(value) => (
      <SelectedValue>
        {options.find((option) => option.value === value)?.label}
      </SelectedValue>
    )}
  />
)

const OptionLabel = styled.span({
  display: "flex",
  alignItems: "center",
  gap: "8px",
})

/** Hidden rather than absent on unselected options, so labels stay aligned. */
const OptionCheck = styled(RiCheckLine)({ flexShrink: 0 })

/** A check marks each selected option, since MUI's selected background alone is color-only. */
const ModulesSelect: React.FC<{
  options: { value: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
  error: boolean
}> = ({ options, value, onChange, error }) => (
  <FilterField
    label="Modules"
    size="medium"
    multiple
    value={value}
    error={error}
    errorText="Couldn't load modules. Reload to try again."
    options={options.map((option) => ({
      value: option.value,
      label: (
        <OptionLabel>
          <OptionCheck
            aria-hidden="true"
            size={16}
            style={{
              visibility: value.includes(option.value) ? "visible" : "hidden",
            }}
          />
          {option.label}
        </OptionLabel>
      ),
    }))}
    renderValue={(selected) => {
      const ids = selected as string[]
      return (
        <SelectedValue>
          {ids.length === 0
            ? "All modules"
            : ids.length === 1
              ? options.find((option) => option.value === ids[0])?.label
              : `${ids.length} modules`}
        </SelectedValue>
      )
    }}
    onChange={(event) => {
      const next = event.target.value
      onChange(typeof next === "string" ? next.split(",") : (next as string[]))
    }}
  />
)

const CheckboxField = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  minHeight: "40px",
  [theme.breakpoints.down("md")]: {
    minHeight: "auto",
  },
}))

const ErrorRow = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "16px",
})

/** `/learners` caps a page at 25 learners, so the export fetches this many pages at a time rather than one by one or all at once. */
const CSV_EXPORT_CONCURRENCY = 5
const UNAVAILABLE_MESSAGE_ID = "learner-analytics-unavailable-message"
const NOT_LOADED_MESSAGE_ID = "learner-analytics-not-loaded-message"
const MODULES_FAILED_MESSAGE_ID = "learner-export-modules-failed-message"

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: ALL, label: "All learners" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "passed", label: "Completed" },
]

type ContractLearnersPageProps = {
  orgSlug: string
  contractSlug: string
}

const ContractLearnersPageInternal: React.FC<ContractLearnersPageProps> = ({
  orgSlug,
  contractSlug,
}) => {
  const {
    page,
    setPage,
    searchQuery,
    setSearchQuery,
    clearSearch,
    debouncedSearch,
    statusFilter,
    setStatusFilter,
    completionStatus,
    needsAttentionOnly,
    setNeedsAttentionOnly,
    gridModules,
    setGridModules,
    clearAll,
  } = useLearnerFilters()
  const [isExporting, setIsExporting] = useState(false)
  const [actionResult, setActionResult] = useState<{
    message: string
    severity: "success" | "error"
  } | null>(null)
  const queryClient = useQueryClient()

  const controlsRef = useRef<HTMLDivElement>(null)
  const handleClearAll = () => {
    clearAll()
    controlsRef.current?.querySelector("input")?.focus()
  }

  const {
    data: managerOrgs,
    isLoading: isLoadingOrgs,
    error: orgsError,
  } = useQuery({
    ...managerOrganizationQueries.managerOrganizationsList(),
    throwOnError: false,
  })

  const org = managerOrgs?.find(matchOrganizationBySlug(orgSlug))
  const contract = org?.contracts.find((item) => item.slug === contractSlug)
  const orgUuid = org?.sso_organization_id ?? null
  const contractId = contract?.id ?? null
  const canQuery = isAnalyticsConfigured() && !!orgUuid && !!contractId

  const courseRunsQuery = useQuery({
    ...analyticsContractQueries.courseRuns(orgUuid ?? "", contractId ?? 0, {
      limit: 1000,
    }),
    enabled: canQuery,
  })

  const courseRunOptions = useMemo(
    () =>
      (courseRunsQuery.data?.data ?? [])
        .map((run) => ({ value: run.courserun_id, label: run.courserun_title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [courseRunsQuery.data],
  )
  /** Kept while loading or on error, so its error text can show. */
  const showModuleFilter = !courseRunsQuery.data || courseRunOptions.length > 1
  const activeGridModules = useMemo(
    () =>
      showModuleFilter
        ? courseRunOptions
            .filter((option) => gridModules.includes(option.value))
            .map((option) => option.value)
        : [],
    [showModuleFilter, gridModules, courseRunOptions],
  )

  const courseRunsSettled = courseRunsQuery.isSuccess || courseRunsQuery.isError
  const gridModulesResolved = gridModules.length === 0 || courseRunsSettled

  const gridFilters = useMemo(
    () => ({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      completion_status: completionStatus,
      /** Only ever sent as `true`: no control here asks for the learners who are fine. */
      ...(needsAttentionOnly ? { needs_attention: true } : {}),
      ...(activeGridModules.length
        ? { courserun_readable_id: activeGridModules }
        : {}),
    }),
    [debouncedSearch, completionStatus, needsAttentionOnly, activeGridModules],
  )
  const gridQuery = useQuery({
    ...gridLearnersQuery(orgUuid ?? "", contractId ?? 0, gridFilters, page),
    enabled: canQuery && gridModulesResolved,
    placeholderData: keepPreviousData,
  })

  /** Read for the contract's learner count and freshness date. */
  const learnerTotalQuery = useQuery({
    ...analyticsContractQueries.learners(orgUuid ?? "", contractId ?? 0, {
      limit: 1,
      offset: 0,
      completion_status: completionStatusFilter(),
    }),
    enabled: canQuery,
  })
  const totalLearners = learnerTotalQuery.data?.total_count ?? null

  /**
   * Only 400/401/403 responses throw to an error boundary (see
   * `makeBrowserQueryClient`); a 5xx or network failure just settles into
   * `isError` with `data` left undefined. The grid shows its own query's
   * failure; this covers the page's.
   */
  const hasLoadError = learnerTotalQuery.isError
  /**
   * The contract exists in MITx Online but the warehouse has not loaded it
   * yet. Not an error a retry can fix, so it gets its own message.
   */
  const notLoaded = [gridQuery, learnerTotalQuery, courseRunsQuery].some(
    (query) => isAnalyticsNotLoaded(query.error),
  )

  const courseRuns = courseRunsQuery.data?.data
  const courseRunsFailed = courseRunsQuery.isError && !courseRuns
  const exportUnavailable =
    !canQuery || notLoaded || !gridModulesResolved || !courseRuns

  const handleExport = useCallback(async () => {
    if (isExporting || exportUnavailable || !orgUuid || !contractId) return
    setIsExporting(true)
    try {
      const fetchPage = (pageNumber: number) =>
        queryClient.fetchQuery(
          gridLearnersQuery(orgUuid, contractId, gridFilters, pageNumber),
        )
      const first = await fetchPage(1)
      const learners: LearnerWithEnrollments[] = [...first.data]
      const pageCount = Math.ceil(first.total_count / GRID_PAGE_SIZE)
      for (let next = 2; next <= pageCount; next += CSV_EXPORT_CONCURRENCY) {
        const batch = await Promise.all(
          Array.from(
            { length: Math.min(CSV_EXPORT_CONCURRENCY, pageCount - next + 1) },
            (_, index) => fetchPage(next + index),
          ),
        )
        learners.push(...batch.flatMap((response) => response.data))
      }
      const csv = buildGridCsv(
        learners,
        gridColumns(courseRuns, activeGridModules),
      )
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `learners-${contractSlug}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      setActionResult({
        message: "CSV download started.",
        severity: "success",
      })
    } catch {
      setActionResult({
        message: "Could not export learners. Please try again.",
        severity: "error",
      })
    } finally {
      setIsExporting(false)
    }
  }, [
    isExporting,
    exportUnavailable,
    orgUuid,
    contractId,
    contractSlug,
    queryClient,
    gridFilters,
    courseRuns,
    activeGridModules,
  ])

  if (isLoadingOrgs) {
    return (
      <Page>
        <Stack gap="24px">
          <Skeleton width="280px" height="48px" />
          <Skeleton width="100%" height="88px" />
          <Skeleton width="100%" height="400px" />
        </Stack>
      </Page>
    )
  }

  if (orgsError) {
    return (
      <Page>
        <ErrorContent
          title={
            isForbiddenResponse(orgsError)
              ? "Access denied"
              : "Something went wrong"
          }
          timSays={isForbiddenResponse(orgsError) ? "403" : "Oops!"}
        />
      </Page>
    )
  }

  if (!org) {
    return (
      <Page>
        <ErrorContent title="Access denied" timSays="403" />
      </Page>
    )
  }

  if (!contract) {
    return (
      <Page>
        <ErrorContent title="Contract not found" timSays="404" />
      </Page>
    )
  }

  const hasModuleFilter = activeGridModules.length > 0

  const hasActiveFilters =
    !!searchQuery ||
    statusFilter !== ALL ||
    hasModuleFilter ||
    needsAttentionOnly

  const emptyMessage = debouncedSearch
    ? "No learners match your search."
    : statusFilter !== ALL || hasModuleFilter || needsAttentionOnly
      ? "No learners match this filter."
      : "No learners found."

  return (
    <Page>
      <Stack gap="24px">
        <HeaderSection>
          <OrgDetailsContainer>
            <ImageContainer>
              <Image
                width={60}
                height={60}
                src={org.logo ?? graduateLogo}
                alt=""
              />
            </ImageContainer>
            <div>
              <OrgName component="h1">{org.name}</OrgName>
              <PageSubtitle component="p">
                Learners · {contract.name}
              </PageSubtitle>
            </div>
          </OrgDetailsContainer>
          <ExportWrapper>
            <Button
              variant="bordered"
              aria-disabled={isExporting || exportUnavailable}
              aria-describedby={
                !canQuery
                  ? UNAVAILABLE_MESSAGE_ID
                  : notLoaded
                    ? NOT_LOADED_MESSAGE_ID
                    : courseRunsFailed
                      ? MODULES_FAILED_MESSAGE_ID
                      : undefined
              }
              aria-busy={
                isExporting ||
                (canQuery &&
                  !notLoaded &&
                  (!gridModulesResolved || courseRunsQuery.isPending))
              }
              onClick={handleExport}
            >
              {isExporting ? "Exporting…" : "Export learners"}
            </Button>
            {courseRunsFailed ? (
              <VisuallyHidden id={MODULES_FAILED_MESSAGE_ID}>
                Export needs this contract&apos;s modules, which couldn&apos;t
                load.
              </VisuallyHidden>
            ) : null}
          </ExportWrapper>
        </HeaderSection>

        <ContractManagerNav
          orgSlug={orgSlug}
          contractSlug={contractSlug}
          current="learners"
        />

        {!canQuery ? (
          <Typography id={UNAVAILABLE_MESSAGE_ID} variant="body1">
            Learner analytics is not available in this environment.
          </Typography>
        ) : notLoaded ? (
          <Typography id={NOT_LOADED_MESSAGE_ID} variant="body1">
            Learner data for {contract.name} will be available once it has been
            loaded. Please check back later.
          </Typography>
        ) : hasLoadError ? (
          <Alert severity="error">
            <ErrorRow>
              <span>Something went wrong loading learner data.</span>
              <Button
                size="small"
                variant="bordered"
                onClick={() => learnerTotalQuery.refetch()}
              >
                Try again
              </Button>
            </ErrorRow>
          </Alert>
        ) : (
          <ResultsSection>
            <AsOfRow>
              <SectionFreshness
                asOf={learnerTotalQuery.data?.as_of}
                isLoading={learnerTotalQuery.isPending}
                isError={learnerTotalQuery.isError}
              />
            </AsOfRow>
            <ControlsRow>
              <SectionHeader
                component="h2"
                title="Learner results"
                description={
                  gridQuery.isError || learnerTotalQuery.isError
                    ? undefined
                    : gridQuery.data && totalLearners !== null
                      ? `${gridQuery.data.total_count} of ${totalLearners} enrolled learners`
                      : "Loading…"
                }
                asOfPlacement="external"
              />
              <ControlsRight ref={controlsRef}>
                <StyledSearchInput
                  placeholder="Search name or email"
                  value={searchQuery}
                  size="medium"
                  onChange={(event) =>
                    setSearchQuery(
                      event.target.value.slice(0, SEARCH_MAX_LENGTH),
                    )
                  }
                  onClear={clearSearch}
                  onSubmit={() => {}}
                />
                <FilterSelect
                  label="Status"
                  size="medium"
                  value={statusFilter}
                  options={STATUS_OPTIONS}
                  onChange={(event) =>
                    setStatusFilter(String(event.target.value))
                  }
                />
                {showModuleFilter ? (
                  <ModulesSelect
                    options={courseRunOptions}
                    value={activeGridModules}
                    onChange={setGridModules}
                    error={courseRunsFailed}
                  />
                ) : null}
                <CheckboxField>
                  <Checkbox
                    label="Not started or inactive 30+ days"
                    checked={needsAttentionOnly}
                    onChange={(event) =>
                      setNeedsAttentionOnly(event.target.checked)
                    }
                  />
                </CheckboxField>
                <Button
                  variant="tertiary"
                  size="medium"
                  onClick={handleClearAll}
                  style={{
                    visibility: hasActiveFilters ? "visible" : "hidden",
                  }}
                >
                  Clear filters
                </Button>
              </ControlsRight>
            </ControlsRow>

            {actionResult ? (
              <Alert
                severity={actionResult.severity}
                closable
                onClose={() => setActionResult(null)}
              >
                {actionResult.message}
              </Alert>
            ) : null}

            <ProgressGrid
              filters={gridFilters}
              query={gridQuery}
              courseRuns={courseRuns}
              courseRunsFailed={courseRunsFailed}
              courseRunsFetching={courseRunsQuery.isFetching}
              onRetryCourseRuns={() => courseRunsQuery.refetch()}
              page={page}
              onPageChange={setPage}
              emptyMessage={emptyMessage}
            />
          </ResultsSection>
        )}
      </Stack>
    </Page>
  )
}

const ContractLearnersPage: React.FC<ContractLearnersPageProps> = (props) => {
  const flagsLoaded = useFeatureFlagsLoaded()
  const analyticsEnabled = useFeatureFlag(FeatureFlags.B2BAnalyticsDashboard)
  const learnerAnalyticsEnabled = useFeatureFlag(
    FeatureFlags.B2BLearnerAnalytics,
  )
  const enabled = analyticsEnabled && learnerAnalyticsEnabled

  if (!flagsLoaded) {
    return (
      <Page>
        <Stack gap="24px">
          <Skeleton width="280px" height="48px" />
          <Skeleton width="100%" height="400px" />
        </Stack>
      </Page>
    )
  }
  if (!enabled) throw new ForbiddenError("Not enabled.")

  return <ContractLearnersPageInternal {...props} />
}

export default ContractLearnersPage
export type { ContractLearnersPageProps }
