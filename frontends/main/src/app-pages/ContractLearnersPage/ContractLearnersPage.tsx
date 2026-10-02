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
  Typography,
} from "ol-components"
import { Alert, Button, Checkbox, VisuallyHidden } from "@mitodl/smoot-design"
import {
  analyticsContractQueries,
  type CompletionStatusFilter,
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
import { contractAnalyticsView } from "@/common/urls"
import SectionHeader, {
  SectionFreshness,
} from "../DashboardPage/Analytics/SectionHeader"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import { LearnerRow } from "./LearnerRow"
import { COLUMN_FLEX } from "./columns"
import { DISPLAY_STATUS_LABEL, getDisplayStatus } from "./statusDisplay"

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

/**
 * The freshness line sits above the section rather than at the end of the
 * header row, where every aggregate section puts it: this row already carries
 * a search box and two filters, so a fourth item there either overflows or
 * wraps to whichever spot is left. Right-aligned so it still reads as
 * belonging to the section's top-right corner.
 */
const AsOfRow = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  // Left-aligned once the header and controls stack: everything else in that
  // column starts at the left edge, so a lone right-aligned line reads as
  // stranded rather than as the section's corner.
  [theme.breakpoints.down("md")]: {
    justifyContent: "flex-start",
  },
}))

const ControlsRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "16px",
  // Wrap rather than overflow. Without this the controls' own min-widths
  // (280px each) win over the container between `md` and roughly 1200px, and
  // the last filter runs off the right edge.
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
  /**
   * Fixed, not `minWidth`: a content-sized select changes width with whatever
   * is selected, so picking a long module title reflowed the whole controls
   * row. `FilterSelect` ellipsizes whatever does not fit; the full title
   * stays in the DOM (so it is still announced) and in the open listbox.
   *
   * Not sized to the longest option either: module titles reach ~50
   * characters, which would leave a control wide enough to crowd out the
   * search box beside it.
   */
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

/**
 * Renders the selected label into an element of its own. MUI ellipsizes the
 * value for you, but smoot-design lays that value box out as a flex
 * container, and `text-overflow` never applies to the anonymous flex item a
 * bare text node becomes — nor can that item shrink below its min-content
 * width, so a long module title ran under the chevron and stopped flat at
 * the border instead of trailing off.
 */
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
const SEARCH_DEBOUNCE_MS = 300
/** Matches the API's cap on `search`; truncated below rather than sent as-is, since a long paste would otherwise 422 and read as "Something went wrong loading learner data" — 422 isn't in the error-boundary set below. */
const SEARCH_MAX_LENGTH = 254
const ALL = "all"
const UNAVAILABLE_MESSAGE_ID = "learner-analytics-unavailable-message"

/**
 * The status dropdown's options. The progress bands the prototype also lists
 * (1-24%, 25-49%, 50-99%) are deliberately absent: the API exposes no
 * percent-complete to filter on.
 */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: ALL, label: "All learners" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "passed", label: "Completed" },
  /** Inert until a real consent field exists — OL_ANALYTICS_API_B2B_DASHBOARD_CONSENT_FAIL_OPEN=true keeps outcomes_shared always true, so this matches zero rows everywhere today. Not a bug; keep it. */
  { value: "unknown", label: "No consent given" },
]

/**
 * "Completed" queries both `passed` and `certified`, matching the count
 * tile above it: a learner who passed but hasn't certified yet is still
 * "Completed" to a manager, and a standalone "Certificate" filter option
 * previously returned fewer rows than the tile it was supposed to explain.
 * The row-level status pill (`getDisplayStatus`) still distinguishes the
 * two outcomes; only the filter groups them.
 */
const STATUS_FILTER_COMPLETION_STATUS: Record<
  string,
  CompletionStatusFilter[]
> = {
  not_started: ["not_started"],
  in_progress: ["in_progress"],
  passed: ["passed", "certified"],
  unknown: ["unknown"],
}

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
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [moduleFilter, setModuleFilter] = useState<string>(ALL)
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const [actionResult, setActionResult] = useState<{
    message: string
    severity: "success" | "error"
  } | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const queryClient = useQueryClient()

  const applyFilterChange = useCallback((apply: () => void) => {
    apply()
    setPage(1)
    // Selection reset (`setSelected(new Set())`) lived here while row
    // selection was enabled — restore it alongside that block.
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [searchQuery])

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

  const completionStatus = useMemo<CompletionStatusFilter[] | undefined>(
    () =>
      statusFilter === ALL
        ? undefined
        : STATUS_FILTER_COMPLETION_STATUS[statusFilter],
    [statusFilter],
  )

  /**
   * One page covers any real contract's course runs, and the dropdown has to
   * list all of them or it silently hides runs a manager could filter by —
   * hence a limit well clear of the count rather than `PAGE_SIZE`.
   */
  const courseRunsQuery = useQuery({
    ...analyticsContractQueries.courseRuns(orgUuid ?? "", contractId ?? "", {
      limit: 1000,
    }),
    enabled: canQuery,
  })

  /**
   * From the contract's own course runs rather than distinct values off the
   * learner rows, so the list does not narrow to whoever consented — and so
   * that a run nobody has enrolled in is still offered.
   */
  const moduleOptions = useMemo(
    () => [
      { value: ALL, label: "All modules" },
      ...(courseRunsQuery.data?.data ?? [])
        // `courserun_id` carries the readable id the filter sends — see
        // `CourseRun`.
        .map((run) => ({ value: run.courserun_id, label: run.courserun_title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [courseRunsQuery.data],
  )

  /**
   * A run can leave the contract while a manager has it selected, and the
   * stale time is short enough that a refetch lands mid-session. Everything
   * below reads this rather than `moduleFilter` so the control, the query and
   * the empty message never disagree: left alone, `FilterSelect` would find no
   * matching option and render an empty box — MUI warns about the out-of-range
   * value — while the table stayed filtered by an id no longer on offer.
   *
   * Derived rather than corrected in an effect, which would both ship that bad
   * render first and discard the selection for good. A run that comes back in
   * a later refetch simply applies again.
   */
  const activeModule = useMemo(
    () =>
      moduleOptions.some((option) => option.value === moduleFilter)
        ? moduleFilter
        : ALL,
    [moduleOptions, moduleFilter],
  )

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
    enabled: canQuery,
    placeholderData: keepPreviousData,
  })

  /**
   * One row is enough: only `total_count` is read. Unfiltered on purpose, so
   * the "X of Y enrollments" summary below stays a fixed total while the
   * table narrows with search/status filters.
   */
  const totalQuery = useQuery({
    ...analyticsContractQueries.learnerProgress(
      orgUuid ?? "",
      contractId ?? "",
      { limit: 1 },
    ),
    enabled: canQuery,
  })

  const rows = rowsQuery.data?.data ?? []
  const filteredCount = rowsQuery.data?.total_count ?? 0
  const withheldCount = rowsQuery.data?.outcomes_withheld_count ?? 0
  const totalEnrollments = totalQuery.data?.total_count ?? null
  const totalPages = Math.ceil(filteredCount / PAGE_SIZE)
  const isStale = rowsQuery.isPlaceholderData || rowsQuery.isFetching
  const isBusy = rowsQuery.isLoading || isStale

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
    if (isExporting || !canQuery || !orgUuid || !contractId) return
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
        // A page that comes back empty while the reported total says otherwise
        // would otherwise spin forever.
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
          /**
           * Raw `YYYY-MM-DD`, which a spreadsheet reads as a date where the
           * screen's "Sep 30, 2026" is just text. Note this is a narrower
           * shape than `enrolled_on` above, a full UTC timestamp — the two
           * date columns are not interchangeable, and normalizing them here
           * would mean picking a calendar day for an instant.
           */
          row.last_active_on,
          /**
           * Blank rather than "No" on a withheld row: the API sends null
           * there, and a spreadsheet column that reads "No" for a learner
           * whose progress is hidden asserts something nobody checked.
           */
          row.needs_attention === null
            ? ""
            : row.needs_attention
              ? "Yes"
              : "No",
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
    orgUuid,
    contractId,
    contractSlug,
    queryClient,
    listParams,
  ])

  // Announce the result count once a filter or search settles, but not on
  // first load and not mid-flight.
  const lastAnnounced = useRef<string | null>(null)
  useEffect(() => {
    if (isBusy || !rowsQuery.data) return
    const key = `${statusFilter}:${activeModule}:${needsAttentionOnly}:${debouncedSearch}`
    if (lastAnnounced.current === null) {
      lastAnnounced.current = key
      return
    }
    if (lastAnnounced.current === key) return
    lastAnnounced.current = key
    setAnnouncement(
      `${filteredCount} ${filteredCount === 1 ? "result" : "results"}`,
    )
  }, [
    isBusy,
    rowsQuery.data,
    statusFilter,
    activeModule,
    needsAttentionOnly,
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

  const emptyMessage = debouncedSearch
    ? "No learners match your search."
    : statusFilter !== ALL || activeModule !== ALL || needsAttentionOnly
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
          <ExportWrapper>
            <Button
              variant="bordered"
              aria-disabled={isExporting || !canQuery}
              aria-describedby={canQuery ? undefined : UNAVAILABLE_MESSAGE_ID}
              aria-busy={isExporting}
              onClick={handleExport}
            >
              {isExporting ? "Exporting…" : "Export learners"}
            </Button>
          </ExportWrapper>
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
                asOf={rowsQuery.data?.as_of}
                isLoading={rowsQuery.isPending}
                isError={rowsQuery.isError}
              />
            </AsOfRow>
            <ControlsRow>
              <SectionHeader
                component="h2"
                title="Learner results"
                description={
                  totalEnrollments === null
                    ? "Loading…"
                    : `${filteredCount} of ${totalEnrollments} enrollments`
                }
                asOfPlacement="external"
              />
              <ControlsRight>
                <StyledSearchInput
                  placeholder="Search name or email"
                  value={searchQuery}
                  size="medium"
                  onChange={(event) =>
                    setSearchQuery(
                      event.target.value.slice(0, SEARCH_MAX_LENGTH),
                    )
                  }
                  onClear={() => applyFilterChange(() => setSearchQuery(""))}
                  onSubmit={() => {}}
                />
                <FilterSelect
                  label="Status"
                  size="medium"
                  value={statusFilter}
                  options={STATUS_OPTIONS}
                  onChange={(event) =>
                    applyFilterChange(() =>
                      setStatusFilter(String(event.target.value)),
                    )
                  }
                />
                <FilterSelect
                  label="Module"
                  size="medium"
                  value={activeModule}
                  options={moduleOptions}
                  /**
                   * Marked on the field rather than folded into
                   * `hasLoadError`: the learner table is unaffected, and
                   * swapping it for the page-level error would be a worse
                   * failure than the dead dropdown. `error` is required for
                   * `errorText` to render at all — see `FormFieldWrapper`.
                   *
                   * Gated on having no data, not on `isError` alone: a failed
                   * *refetch* leaves the last good list in place, and claiming
                   * failure over a dropdown that still lists every module and
                   * filters correctly is worse than saying nothing.
                   */
                  error={courseRunsQuery.isError && !courseRunsQuery.data}
                  errorText="Couldn't load modules. Reload to try again."
                  onChange={(event) =>
                    applyFilterChange(() =>
                      setModuleFilter(String(event.target.value)),
                    )
                  }
                />
                <CheckboxField>
                  <Checkbox
                    label="Needs attention only"
                    checked={needsAttentionOnly}
                    onChange={(event) =>
                      applyFilterChange(() =>
                        setNeedsAttentionOnly(event.target.checked),
                      )
                    }
                  />
                </CheckboxField>
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

            {withheldCount > 0 ? (
              <ConsentNotice component="p">
                {withheldCount} of these {filteredCount} enrollments belong to
                learners who have not agreed to share their progress. Their
                status, grade and activity read “No consent given”.
              </ConsentNotice>
            ) : null}

            {/*
              The API matches withheld rows against neither `true` nor `false`,
              so this filter hides them outright rather than listing them as
              not needing attention. Said here because nothing else on the page
              would show it: `outcomes_withheld_count` counts the rows that
              matched, so the notice above goes quiet at the same moment.
            */}
            {needsAttentionOnly ? (
              <ConsentNotice component="p">
                Learners who have not agreed to share their progress are hidden
                while this filter is on. Whether they need attention can only be
                read from the progress they withheld. Clear the filter to see
                them.
              </ConsentNotice>
            ) : null}

            <TableCard>
              <VisuallyHidden role="status" aria-atomic="true">
                {rowsQuery.isLoading
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
                  {rowsQuery.isLoading ? (
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
