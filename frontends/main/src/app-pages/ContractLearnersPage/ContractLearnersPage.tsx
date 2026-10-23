"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import NextLink from "next/link"
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { RiArrowLeftLine } from "@remixicon/react"
import {
  Container,
  Pagination,
  SearchInput,
  SimpleSelectField,
  Skeleton,
  Stack,
  styled,
  TabContext,
  TabPanel,
  Typography,
} from "ol-components"
import {
  Alert,
  Button,
  Checkbox,
  TabButton,
  TabButtonList,
  VisuallyHidden,
} from "@mitodl/smoot-design"
import {
  analyticsContractQueries,
  type LearnerProgress,
} from "api/analytics-hooks/organizations"
import { managerOrganizationQueries } from "api/mitxonline-hooks/organizations"
import { isAnalyticsConfigured } from "api/runtime"
import {
  AriaDisabledButtonWrapper,
  buildCsvRow,
  EmptyTableMessage,
  TableBody,
  TableCard,
  TableFooter,
  TableFootnote,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from "@/components/B2BTable/B2BTable"
import { matchOrganizationBySlug } from "@/common/utils"
import { ForbiddenError, isForbiddenResponse } from "@/common/errors"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { analytics } from "@/common/analytics"
import { contractAnalyticsView } from "@/common/urls"
import SectionHeader, {
  SectionFreshness,
} from "../DashboardPage/Analytics/SectionHeader"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import { LearnerRow } from "./LearnerRow"
import { COLUMN_FLEX } from "./columns"
import { DISPLAY_STATUS_LABEL, getDisplayStatus } from "./statusDisplay"
import { ProgressGrid } from "./ProgressGrid"
import {
  ALL,
  SEARCH_MAX_LENGTH,
  VIEWS,
  useLearnerFilters,
  type View,
} from "./useLearnerFilters"

/**
 * The B2B learner directory: one row per learner per course run under a
 * contract.
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

const BackLink = styled(NextLink)(({ theme }) => ({
  ...theme.typography.subtitle3,
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  color: theme.custom.colors.mitRed,
  textDecoration: "none",
  ":hover": { textDecoration: "underline" },
}))

const HeaderSection = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "24px",
  paddingBottom: "16px",
  borderBottom: `2px solid ${theme.custom.colors.black}`,
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "stretch",
  },
}))

const Eyebrow = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle4,
  color: theme.custom.colors.mitRed,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
})) as typeof Typography

const PageTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h2,
  color: theme.custom.colors.black,
})) as typeof Typography

const PageSubtitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
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

const ControlsRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "stretch",
  },
}))

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

const ConsentNotice = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const CheckboxField = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  minHeight: "40px",
  [theme.breakpoints.down("md")]: {
    minHeight: "auto",
  },
}))

const ViewPanel = styled(TabPanel)({
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  "&[hidden]": { display: "none" },
})

const ErrorRow = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "16px",
})

const PAGE_SIZE = 25
/** Below the API's max_page_size rather than pinned to it — that setting is env-overridable, and this only costs one extra round trip on a large contract. */
const CSV_EXPORT_PAGE_SIZE = 500
const UNAVAILABLE_MESSAGE_ID = "learner-analytics-unavailable-message"

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: ALL, label: "All learners" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "passed", label: "Completed" },
  { value: "unknown", label: "Consent withheld" },
]

const rowIdOf = (row: LearnerProgress) =>
  `${row.learner_id}:${row.courserun_readable_id}`

type ContractLearnersPageProps = {
  orgSlug: string
  contractSlug: string
}

const ContractLearnersPageInternal: React.FC<ContractLearnersPageProps> = ({
  orgSlug,
  contractSlug,
}) => {
  const {
    view,
    setView,
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
    moduleFilter,
    setModuleFilter,
    clearAll,
  } = useLearnerFilters()
  const [isExporting, setIsExporting] = useState(false)
  const [actionResult, setActionResult] = useState<{
    message: string
    severity: "success" | "error"
  } | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const queryClient = useQueryClient()

  const controlsRef = useRef<HTMLDivElement>(null)
  const handleClearAll = () => {
    clearAll()
    controlsRef.current?.querySelector("input")?.focus()
  }

  const handleViewChange = (_event: React.SyntheticEvent, next: View) => {
    if (next === view) return
    analytics.analyticsViewChanged({
      view: next,
      previousView: view,
      orgSlug,
      contractSlug,
    })
    setView(next)
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
  const contractId = contract ? String(contract.id) : null
  const canQuery = isAnalyticsConfigured() && !!orgUuid && !!contractId

  const courseRunsQuery = useQuery({
    ...analyticsContractQueries.courseRuns(orgUuid ?? "", contractId ?? "", {
      limit: 1000,
    }),
    enabled: canQuery,
  })

  const moduleOptions = useMemo(
    () => [
      { value: ALL, label: "All modules" },
      ...(courseRunsQuery.data?.data ?? [])
        .map((run) => ({ value: run.courserun_id, label: run.courserun_title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [courseRunsQuery.data],
  )

  const activeModule = useMemo(
    () =>
      moduleOptions.some((option) => option.value === moduleFilter)
        ? moduleFilter
        : ALL,
    [moduleOptions, moduleFilter],
  )

  const moduleResolved =
    moduleFilter === ALL || courseRunsQuery.isSuccess || courseRunsQuery.isError

  const listParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      sort: "full_name" as const,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(completionStatus ? { completion_status: completionStatus } : {}),
      ...(activeModule === ALL ? {} : { courserun_readable_id: activeModule }),
      /**
       * Only ever sent as `true`. The param also takes `false` — "only the
       * learners who are fine" — but that is a question no control here asks,
       * and sending it when the box is unchecked would drop every withheld
       * row from the default view.
       */
      ...(needsAttentionOnly ? { needs_attention: true } : {}),
    }),
    [page, debouncedSearch, completionStatus, activeModule, needsAttentionOnly],
  )

  const rowsQuery = useQuery({
    ...analyticsContractQueries.learnerProgress(
      orgUuid ?? "",
      contractId ?? "",
      listParams,
    ),
    enabled: canQuery && moduleResolved && view === VIEWS.enrollments,
    placeholderData: keepPreviousData,
  })

  const totalQuery = useQuery({
    ...analyticsContractQueries.learnerProgress(
      orgUuid ?? "",
      contractId ?? "",
      { limit: 1 },
    ),
    enabled: canQuery,
  })

  const showsLearnerCount =
    view === VIEWS.enrollments &&
    needsAttentionOnly &&
    !debouncedSearch &&
    statusFilter === ALL &&
    activeModule === ALL
  const needsAttentionQuery = useQuery({
    ...analyticsContractQueries.needsAttention(orgUuid ?? "", contractId ?? ""),
    enabled: canQuery && showsLearnerCount,
  })
  const learnersNeedingAttention = showsLearnerCount
    ? (needsAttentionQuery.data?.data[0]?.learners_needing_attention ?? null)
    : null

  const rows = rowsQuery.data?.data ?? []
  const filteredCount = rowsQuery.data?.total_count ?? 0
  const withheldCount = rowsQuery.data?.outcomes_withheld_count ?? 0
  const totalEnrollments = totalQuery.data?.total_count ?? null
  const contractWithheldCount = totalQuery.data?.outcomes_withheld_count ?? 0
  const hidesWithheldLearners = needsAttentionOnly && contractWithheldCount > 0
  const totalPages = Math.ceil(filteredCount / PAGE_SIZE)
  const isStale = rowsQuery.isPlaceholderData || rowsQuery.isFetching
  const isBusy = rowsQuery.isPending || isStale

  useEffect(() => {
    if (
      view === VIEWS.enrollments &&
      !isBusy &&
      totalPages > 0 &&
      page > totalPages
    ) {
      setPage(totalPages)
    }
  }, [view, isBusy, page, totalPages, setPage])

  /**
   * Only 400/401/403 responses throw to an error boundary (see
   * `makeBrowserQueryClient`); a 5xx or network failure just settles into
   * `isError` with `data` left undefined. Without this check, that failure
   * reads as "no learners" instead of surfacing the error state below.
   */
  const hasLoadError = rowsQuery.isError || totalQuery.isError

  const retryFailedQueries = () => {
    rowsQuery.refetch()
    totalQuery.refetch()
  }

  const handleExport = useCallback(async () => {
    if (isExporting || !canQuery || !moduleResolved || !orgUuid || !contractId)
      return
    setIsExporting(true)
    try {
      const all: LearnerProgress[] = []
      let offset = 0
      let total = Number.POSITIVE_INFINITY
      while (all.length < total) {
        const data = await queryClient.fetchQuery(
          analyticsContractQueries.learnerProgress(orgUuid, contractId, {
            ...listParams,
            limit: CSV_EXPORT_PAGE_SIZE,
            offset,
          }),
        )
        all.push(...data.data)
        total = data.total_count
        if (data.data.length === 0) break
        offset += CSV_EXPORT_PAGE_SIZE
      }
      const header = buildCsvRow([
        "Name",
        "Email",
        "Course",
        "Course ID",
        "Status",
        "Enrolled on",
        "Last activity",
        "Needs attention",
      ])
      const body = all.map((row) =>
        buildCsvRow([
          row.full_name,
          row.email,
          row.courserun_title,
          row.courserun_readable_id,
          DISPLAY_STATUS_LABEL[getDisplayStatus(row)],
          row.enrolled_on,
          row.last_active_on,
          typeof row.needs_attention === "boolean"
            ? row.needs_attention
              ? "Yes"
              : "No"
            : "",
        ]),
      )
      const csv = [header, ...body].join("\n")
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
    canQuery,
    moduleResolved,
    orgUuid,
    contractId,
    contractSlug,
    queryClient,
    listParams,
  ])

  const lastAnnounced = useRef<string | null>(null)
  useEffect(() => {
    if (view !== VIEWS.enrollments || isBusy || !rowsQuery.data) return
    const key = `${statusFilter}:${activeModule}:${needsAttentionOnly}:${debouncedSearch}`
    if (lastAnnounced.current === null) {
      lastAnnounced.current = key
      return
    }
    if (lastAnnounced.current === key) return
    lastAnnounced.current = key
    setAnnouncement(
      `${filteredCount} ${filteredCount === 1 ? "result" : "results"}${
        hidesWithheldLearners
          ? ". Learners who have not agreed to share their progress are hidden."
          : ""
      }`,
    )
  }, [
    view,
    isBusy,
    rowsQuery.data,
    statusFilter,
    activeModule,
    needsAttentionOnly,
    hidesWithheldLearners,
    debouncedSearch,
    filteredCount,
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

  const hasActiveFilters =
    !!searchQuery ||
    statusFilter !== ALL ||
    (view === VIEWS.enrollments && activeModule !== ALL) ||
    needsAttentionOnly

  const emptyMessage = debouncedSearch
    ? "No learners match your search."
    : statusFilter !== ALL ||
        (view === VIEWS.enrollments && activeModule !== ALL) ||
        needsAttentionOnly
      ? "No learners match this filter."
      : "No learners found."

  return (
    <Page>
      <Stack gap="24px">
        <div>
          <BackLink href={contractAnalyticsView(orgSlug, contractSlug)}>
            <RiArrowLeftLine size={16} aria-hidden="true" />
            Program analytics
          </BackLink>
        </div>

        <HeaderSection>
          <div>
            <Eyebrow component="p">Learner Directory</Eyebrow>
            <PageTitle component="h1">Learners</PageTitle>
            <PageSubtitle component="p">{contract.name}</PageSubtitle>
          </div>
          {view === VIEWS.enrollments ? (
            <ExportWrapper>
              <Button
                variant="bordered"
                aria-disabled={isExporting || !canQuery || !moduleResolved}
                aria-describedby={canQuery ? undefined : UNAVAILABLE_MESSAGE_ID}
                aria-busy={isExporting || (canQuery && !moduleResolved)}
                onClick={handleExport}
              >
                {isExporting ? "Exporting…" : "Export learners"}
              </Button>
            </ExportWrapper>
          ) : null}
        </HeaderSection>

        {!canQuery ? (
          <Typography id={UNAVAILABLE_MESSAGE_ID} variant="body1">
            Learner analytics is not available in this environment.
          </Typography>
        ) : hasLoadError ? (
          <Alert severity="error">
            <ErrorRow>
              <span>Something went wrong loading learner data.</span>
              <Button
                size="small"
                variant="bordered"
                onClick={retryFailedQueries}
              >
                Try again
              </Button>
            </ErrorRow>
          </Alert>
        ) : (
          <ResultsSection>
            <AsOfRow>
              <SectionFreshness
                asOf={totalQuery.data?.as_of}
                isLoading={totalQuery.isPending}
                isError={totalQuery.isError}
              />
            </AsOfRow>
            <TabContext value={view}>
              <TabButtonList
                aria-label="Learner views"
                onChange={handleViewChange}
              >
                <TabButton label="By enrollment" value={VIEWS.enrollments} />
                <TabButton label="Progress grid" value={VIEWS.grid} />
              </TabButtonList>
              <ControlsRow>
                <SectionHeader
                  component="h2"
                  title="Learner results"
                  description={
                    view === VIEWS.grid
                      ? "One row per learner, one column per module"
                      : totalEnrollments === null
                        ? "Loading…"
                        : `${filteredCount} of ${totalEnrollments} enrollments${
                            learnersNeedingAttention === null
                              ? ""
                              : ` (${learnersNeedingAttention} ${
                                  learnersNeedingAttention === 1
                                    ? "learner"
                                    : "learners"
                                })`
                          }`
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
                  {view === VIEWS.enrollments ? (
                    <FilterSelect
                      label="Module"
                      size="medium"
                      value={activeModule}
                      options={moduleOptions}
                      error={courseRunsQuery.isError && !courseRunsQuery.data}
                      errorText="Couldn't load modules. Reload to try again."
                      onChange={(event) =>
                        setModuleFilter(String(event.target.value))
                      }
                    />
                  ) : null}
                  <CheckboxField>
                    <Checkbox
                      label="Needs attention only"
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

              <VisuallyHidden aria-live="assertive" aria-atomic="true">
                {announcement}
              </VisuallyHidden>

              <ViewPanel value={VIEWS.enrollments}>
                {withheldCount > 0 ? (
                  <ConsentNotice component="p">
                    {withheldCount} of these {filteredCount} enrollments belong
                    to learners who have not agreed to share their progress.
                    Their status, grade and activity read “Declined” or “Consent
                    not recorded”.
                  </ConsentNotice>
                ) : null}

                {/*
              The API matches withheld rows against neither `true` nor `false`,
              so this filter hides them outright rather than listing them as
              not needing attention. Said here because nothing else on the page
              would show it: the notice above reads the filtered envelope,
              whose withheld count is zero for that same reason.
              */}
                {hidesWithheldLearners ? (
                  <ConsentNotice component="p">
                    Learners who have not agreed to share their progress are
                    hidden while this filter is on. Whether they need attention
                    cannot be determined. Clear this filter, then adjust any
                    other active filters or search terms as needed to see them.
                  </ConsentNotice>
                ) : null}

                <TableCard>
                  <VisuallyHidden role="status" aria-atomic="true">
                    {rowsQuery.isPending
                      ? "Loading learners"
                      : filteredCount === 0
                        ? emptyMessage
                        : `Showing page ${page} of ${Math.max(totalPages, 1)}`}
                  </VisuallyHidden>
                  <div
                    role="table"
                    aria-label="Learner progress"
                    aria-busy={isBusy}
                  >
                    <div role="rowgroup">
                      <TableHeaderRow role="row">
                        <TableHeaderCell
                          role="columnheader"
                          $flex={COLUMN_FLEX.learner}
                        >
                          Learner
                        </TableHeaderCell>
                        <TableHeaderCell
                          role="columnheader"
                          $flex={COLUMN_FLEX.status}
                        >
                          Status
                        </TableHeaderCell>
                        <TableHeaderCell
                          role="columnheader"
                          $flex={COLUMN_FLEX.lastActivity}
                        >
                          Last activity
                        </TableHeaderCell>
                      </TableHeaderRow>
                    </div>
                    <TableBody role="rowgroup" $stale={isStale}>
                      {rowsQuery.isPending ? (
                        [1, 2, 3].map((key) => (
                          <TableRow key={key} role="row">
                            <div role="cell" style={{ width: "100%" }}>
                              <Skeleton width="100%" height="48px" />
                            </div>
                          </TableRow>
                        ))
                      ) : rows.length === 0 ? (
                        <TableRow role="row">
                          <EmptyTableMessage
                            component="div"
                            role="cell"
                            aria-colspan={3}
                            style={{ width: "100%" }}
                          >
                            {emptyMessage}
                          </EmptyTableMessage>
                        </TableRow>
                      ) : (
                        rows.map((row) => (
                          <LearnerRow key={rowIdOf(row)} row={row} />
                        ))
                      )}
                    </TableBody>
                  </div>
                  <TableFooter>
                    <TableFootnote component="p">
                      {filteredCount > 0
                        ? `Page ${page} of ${Math.max(totalPages, 1)}`
                        : ""}
                    </TableFootnote>
                    {totalPages > 1 ? (
                      <Pagination
                        count={totalPages}
                        page={page}
                        shape="rounded"
                        size="small"
                        onChange={(_event, value) => setPage(value)}
                      />
                    ) : null}
                  </TableFooter>
                </TableCard>
              </ViewPanel>

              <ViewPanel value={VIEWS.grid}>
                {orgUuid && contractId ? (
                  <ProgressGrid
                    orgUuid={orgUuid}
                    contractId={contractId}
                    search={debouncedSearch}
                    completionStatus={completionStatus}
                    needsAttentionOnly={needsAttentionOnly}
                    courseRuns={courseRunsQuery.data?.data}
                    courseRunsFailed={
                      courseRunsQuery.isError && !courseRunsQuery.data
                    }
                    courseRunsFetching={courseRunsQuery.isFetching}
                    onRetryCourseRuns={() => courseRunsQuery.refetch()}
                    page={page}
                    onPageChange={setPage}
                    emptyMessage={emptyMessage}
                  />
                ) : null}
              </ViewPanel>
            </TabContext>
          </ResultsSection>
        )}
      </Stack>
    </Page>
  )
}

const ContractLearnersPage: React.FC<ContractLearnersPageProps> = (props) => {
  const flagsLoaded = useFeatureFlagsLoaded()
  const analyticsEnabled = useFeatureFlagEnabled(
    FeatureFlags.B2BAnalyticsDashboard,
  )
  const learnerAnalyticsEnabled = useFeatureFlagEnabled(
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
