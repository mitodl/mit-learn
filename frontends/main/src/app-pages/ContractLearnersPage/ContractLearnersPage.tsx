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
import { Alert, Button, VisuallyHidden } from "@mitodl/smoot-design"
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
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import { LearnerRow } from "./LearnerRow"
import { COLUMN_FLEX } from "./columns"

/**
 * The B2B learner directory: one row per learner per course run under a
 * contract, with the status a manager needs to see who is falling behind.
 *
 * # Where this sits
 *
 * A third page alongside `ContractAdminPage` (seat administration) and
 * `AnalyticsContent` (aggregate reporting), sharing their table primitives so
 * the three read as one product. It is routed outside `/dashboard` — see
 * `CONTRACT_LEARNERS_VIEW` — so it gets no sidebar and can use the full width
 * this table needs.
 *
 * # What is real, and what is disabled
 *
 * The status pill, the four count tiles (Enrollments/Not started/In
 * progress/Completed), search, the status filter and CSV export are backed
 * by `learner-progress` and are real. `courserun_title` under each learner's
 * name is also real — enrollment metadata, not consent-gated.
 *
 * Everything else this feature was designed to show is implemented but
 * commented out, not deleted, so nothing fabricated ships while the table
 * stays ready to turn each one back on — search this file and
 * `LearnerRow.tsx` for "Disabled:" to find each block:
 *   - Selection + Send reminder: no endpoint exists to nudge an enrolled
 *     learner (MITx Online's remind mutation only covers an unredeemed seat
 *     code), so both were hidden rather than shipped as dead buttons.
 *   - Module filter: sends `courserun_readable_id`, a parameter the real
 *     `ol-analytics-api` does not implement (confirmed against its router
 *     source — an unrecognized query param is silently dropped, not
 *     rejected). Left visible it would look like it filters and wouldn't.
 *   - Progress (table cell and CSV columns alike) and Last activity: both
 *     fabricate a value with no real field behind them yet — see
 *     `placeholders.ts`'s header comment for what each is blocked on.
 *   - The "Needs attention" tile: there is no `needs_attention` field yet,
 *     so even an honest empty-dash tile has nothing behind it.
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

const StatsRow = styled.div(({ theme }) => ({
  display: "flex",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}))

const StatTile = styled.div<{ $emphasis: boolean }>(({ $emphasis, theme }) => ({
  flex: 1,
  minWidth: 0,
  padding: "16px 24px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
  ":first-of-type": { borderLeft: "none" },
  ...($emphasis && {
    borderLeft: `3px solid ${theme.custom.colors.mitRed}`,
  }),
  [theme.breakpoints.down("md")]: {
    borderLeft: "none",
    borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
    ":first-of-type": { borderTop: "none" },
    ...($emphasis && {
      borderLeft: `3px solid ${theme.custom.colors.mitRed}`,
      borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
    }),
  },
}))

const StatLabel = styled.div<{ $emphasis: boolean }>(
  ({ $emphasis, theme }) => ({
    ...theme.typography.body2,
    color: $emphasis
      ? theme.custom.colors.mitRed
      : theme.custom.colors.silverGrayDark,
  }),
)

const StatValue = styled.div<{ $emphasis: boolean }>(
  ({ $emphasis, theme }) => ({
    ...theme.typography.h4,
    color: $emphasis ? theme.custom.colors.mitRed : theme.custom.colors.black,
  }),
)

const ResultsSection = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const ControlsRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "16px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "stretch",
  },
}))

const ControlsRight = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  gap: "12px",
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
    minWidth: "280px",
  },
  [theme.breakpoints.down("md")]: {
    width: "100%",
    "& .MuiSelect-root": {
      minWidth: "auto",
      width: "100%",
    },
  },
}))

const SectionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.black,
})) as typeof Typography

const ResultsCount = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const ConsentNotice = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const ErrorRow = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "16px",
})

// --- Disabled: placeholder-data footnote ----------------------------------
//
// Unused while nothing fabricated renders on screen — see its JSX comment
// further down for why.
//
// const PlaceholderNotice = styled(Typography)(({ theme }) => ({
//   ...theme.typography.body3,
//   color: theme.custom.colors.silverGrayDark,
// })) as typeof Typography
// --------------------------------------------------------------------------

// --- Disabled: bulk selection bar (Select all + Send reminder) -----------
//
// Exists only to drive the bulk "Send reminder" action — see the file header
// comment. Restore alongside LearnerRow.tsx's matching block.
//
// /** Same card treatment as the results table below it, so the two read as one surface. */
// const BulkBar = styled(TableCard)({
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "space-between",
//   gap: "16px",
// })
//
// const BulkLabel = styled.label(({ theme }) => ({
//   display: "flex",
//   alignItems: "center",
//   gap: "8px",
//   ...theme.typography.subtitle2,
//   color: theme.custom.colors.black,
//   cursor: "pointer",
// }))
//
// const SelectHeaderCell = styled.div({ width: "40px", flexShrink: 0 })
// const ActionHeaderCell = styled.div({ width: "140px", flexShrink: 0 })
// --------------------------------------------------------------------------

// --- Disabled: fabricated "Needs attention" tile --------------------------
//
// There is no `needs_attention` field yet, so even the honest empty-dash
// version of this tile has nothing behind it. Built and kept here for when
// the field ships — see the file header comment.
//
// import { PLACEHOLDER_ATTR } from "./placeholders"
// import { STUB } from "@/components/B2BTable/B2BTable"
// --------------------------------------------------------------------------

const PAGE_SIZE = 25
const CSV_EXPORT_PAGE_SIZE = 1000
const SEARCH_DEBOUNCE_MS = 300
const ALL = "all"

/**
 * The status dropdown's options. The progress bands the prototype also lists
 * (1-24%, 25-49%, 50-99%) are deliberately absent: they filter on progress
 * data that does not exist, so they could only ever filter placeholder values.
 */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: ALL, label: "All learners" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "passed", label: "Completed" },
  { value: "certified", label: "Certificate" },
  { value: "unknown", label: "No consent given" },
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
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
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
        : [statusFilter as CompletionStatusFilter],
    [statusFilter],
  )

  const listParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      include_inactive: true,
      sort: "full_name" as const,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(completionStatus ? { completion_status: completionStatus } : {}),
      // courserun_readable_id (module filter) dropped here — see file header.
    }),
    [page, debouncedSearch, completionStatus],
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
   * the tiles stay a fixed summary of the contract while the table below them
   * narrows.
   */
  const countParams = (status?: CompletionStatusFilter[]) => ({
    limit: 1,
    include_inactive: true,
    ...(status ? { completion_status: status } : {}),
  })

  const totalQuery = useQuery({
    ...analyticsContractQueries.learnerProgress(
      orgUuid ?? "",
      contractId ?? "",
      countParams(),
    ),
    enabled: canQuery,
  })
  const notStartedQuery = useQuery({
    ...analyticsContractQueries.learnerProgress(
      orgUuid ?? "",
      contractId ?? "",
      countParams(["not_started"]),
    ),
    enabled: canQuery,
  })
  const inProgressQuery = useQuery({
    ...analyticsContractQueries.learnerProgress(
      orgUuid ?? "",
      contractId ?? "",
      countParams(["in_progress"]),
    ),
    enabled: canQuery,
  })
  const completedQuery = useQuery({
    ...analyticsContractQueries.learnerProgress(
      orgUuid ?? "",
      contractId ?? "",
      countParams(["passed", "certified"]),
    ),
    enabled: canQuery,
  })

  // --- Disabled: module filter --------------------------------------------
  //
  // Sends `courserun_readable_id`, a parameter the real ol-analytics-api does
  // not implement — see the file header comment. `enrollmentFunnel` was
  // fetched here only to populate this dropdown's options.
  //
  // const funnelQuery = useQuery({
  //   ...analyticsContractQueries.enrollmentFunnel(
  //     orgUuid ?? "",
  //     contractId ?? "",
  //     { limit: 1000 },
  //   ),
  //   enabled: canQuery,
  // })
  //
  // const moduleOptions = useMemo(() => {
  //   const seen = new Map<string, string>()
  //   for (const row of funnelQuery.data?.data ?? []) {
  //     if (!seen.has(row.courserun_readable_id)) {
  //       seen.set(row.courserun_readable_id, row.courserun_title)
  //     }
  //   }
  //   return [
  //     { value: ALL, label: "All modules" },
  //     ...[...seen.entries()]
  //       .map(([value, label]) => ({ value, label }))
  //       .sort((a, b) => a.label.localeCompare(b.label)),
  //   ]
  // }, [funnelQuery.data])
  // -------------------------------------------------------------------------

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
   * reads as "no learners" and the count tiles below spin forever, since
   * their skeletons key off `data` being null rather than off load state.
   */
  const hasLoadError =
    rowsQuery.isError ||
    totalQuery.isError ||
    notStartedQuery.isError ||
    inProgressQuery.isError ||
    completedQuery.isError

  const retryFailedQueries = () => {
    rowsQuery.refetch()
    totalQuery.refetch()
    notStartedQuery.refetch()
    inProgressQuery.refetch()
    completedQuery.refetch()
  }

  // --- Disabled: row/bulk selection ---------------------------------------
  //
  // Only consumer is "Send reminder" — see the file header comment. Restore
  // together with LearnerRow.tsx's matching block, the BulkBar JSX below, and
  // the `setSelected(new Set())` calls noted in applyFilterChange and the
  // search-debounce effect above.
  //
  // const [selected, setSelected] = useState<Set<string>>(new Set())
  //
  // const visibleIds = rows.map(rowIdOf)
  // const selectedVisible = visibleIds.filter((id) => selected.has(id))
  // const allVisibleSelected =
  //   visibleIds.length > 0 && selectedVisible.length === visibleIds.length
  // const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected
  //
  // const toggleSelect = useCallback((rowId: string) => {
  //   setSelected((current) => {
  //     const next = new Set(current)
  //     if (next.has(rowId)) next.delete(rowId)
  //     else next.add(rowId)
  //     return next
  //   })
  // }, [])
  //
  // const toggleSelectAll = useCallback(() => {
  //   setSelected((current) => {
  //     const next = new Set(current)
  //     const everySelected = visibleIds.every((id) => next.has(id))
  //     for (const id of visibleIds) {
  //       if (everySelected) next.delete(id)
  //       else next.add(id)
  //     }
  //     return next
  //   })
  // }, [visibleIds])
  //
  // /**
  //  * PLACEHOLDER. No endpoint can nudge an enrolled learner: MITx Online's
  //  * remind mutation resends the claim email for an *unredeemed* seat code, and
  //  * every row here belongs to someone who already redeemed one. Wired to the
  //  * real UI so only this handler changes when an endpoint exists.
  //  */
  // const sendReminder = useCallback((rowIds: string[]) => {
  //   const message = `Reminders are not available yet. ${rowIds.length} learner${
  //     rowIds.length === 1 ? "" : "s"
  //   } would have been sent one.`
  //   setActionResult({ message, severity: "error" })
  //   setAnnouncement("")
  //   setTimeout(() => setAnnouncement(message), 100)
  // }, [])
  // -------------------------------------------------------------------------

  const handleExport = useCallback(async () => {
    if (isExporting || !orgUuid || !contractId) return
    setIsExporting(true)
    try {
      const all: LearnerProgress[] = []
      let offset = 0
      let total = Number.POSITIVE_INFINITY
      while (all.length < total) {
        const data = await queryClient.fetchQuery(
          analyticsContractQueries.learnerProgress(orgUuid, contractId, {
            limit: CSV_EXPORT_PAGE_SIZE,
            offset,
            include_inactive: true,
          }),
        )
        all.push(...data.data)
        total = data.total_count
        // A page that comes back empty while the reported total says otherwise
        // would otherwise spin forever.
        if (data.data.length === 0) break
        offset += CSV_EXPORT_PAGE_SIZE
      }
      // Last activity is omitted while it is a placeholder: a CSV outlives
      // the screen and carries no "preview" marking with it.
      const header = buildCsvRow([
        "Name",
        "Email",
        "Course",
        "Course ID",
        "Status",
        "Enrolled on",
        // Disabled: fabricated Progress — see LearnerRow.tsx's and
        // placeholders.ts's "Disabled:" comments. Built and kept here rather
        // than shipped with invented numbers.
        // "Progress %",
        // "Lessons Completed",
        // "Lessons Total",
      ])
      const body = all.map((row) => {
        // Disabled: fabricated Progress — see the header comment above.
        // const progress = placeholderProgress(row)
        return buildCsvRow([
          row.full_name,
          row.email,
          row.courserun_title,
          row.courserun_readable_id,
          row.outcomes_shared
            ? (row.completion_status ?? "")
            : "No consent given",
          row.enrolled_on,
          // progress ? String(progress.percent) : "",
          // progress ? String(progress.lessonsCompleted) : "",
          // progress ? String(progress.lessonsTotal) : "",
        ])
      })
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
  }, [isExporting, orgUuid, contractId, contractSlug, queryClient])

  // Announce the result count once a filter or search settles, but not on
  // first load and not mid-flight.
  const lastAnnounced = useRef<string | null>(null)
  useEffect(() => {
    if (isBusy || !rowsQuery.data) return
    const key = `${statusFilter}:${debouncedSearch}`
    if (lastAnnounced.current === null) {
      lastAnnounced.current = key
      return
    }
    if (lastAnnounced.current === key) return
    lastAnnounced.current = key
    setAnnouncement(
      `${filteredCount} ${filteredCount === 1 ? "result" : "results"}`,
    )
  }, [isBusy, rowsQuery.data, statusFilter, debouncedSearch, filteredCount])

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
              aria-disabled={isExporting}
              aria-busy={isExporting}
              onClick={handleExport}
            >
              {isExporting ? "Exporting…" : "Export learners"}
            </Button>
          </ExportWrapper>
        </HeaderSection>

        {!canQuery ? (
          <Typography variant="body1">
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
          <>
            <StatsRow>
              {[
                { label: "Enrollments", value: totalEnrollments },
                {
                  label: "Not started",
                  value: notStartedQuery.data?.total_count ?? null,
                },
                {
                  label: "In progress",
                  value: inProgressQuery.data?.total_count ?? null,
                },
                {
                  label: "Completed",
                  value: completedQuery.data?.total_count ?? null,
                },
              ].map((tile) => (
                <StatTile
                  key={tile.label}
                  $emphasis={false}
                  role="group"
                  aria-label={tile.label}
                >
                  <StatLabel $emphasis={false}>{tile.label}</StatLabel>
                  {tile.value === null ? (
                    <Skeleton width="48px" height="32px" />
                  ) : (
                    <StatValue $emphasis={false}>{tile.value}</StatValue>
                  )}
                </StatTile>
              ))}
              {/* Disabled: fabricated "Needs attention" tile — see the
                  top-of-file "Disabled: fabricated Needs attention tile"
                  comment for the import lines this JSX needs.
              <StatTile $emphasis role="group" aria-label="Needs attention">
                <StatLabel $emphasis>Needs attention</StatLabel>
                <StatValue
                  $emphasis
                  {...{ [PLACEHOLDER_ATTR]: "needs-attention" }}
                >
                  {STUB}
                </StatValue>
              </StatTile>
              */}
            </StatsRow>

            <ResultsSection>
              <ControlsRow>
                <div>
                  <SectionTitle component="h2">Learner results</SectionTitle>
                  <ResultsCount component="p">
                    {totalEnrollments === null
                      ? "Loading…"
                      : `${filteredCount} of ${totalEnrollments} enrollments`}
                  </ResultsCount>
                </div>
                <ControlsRight>
                  <StyledSearchInput
                    placeholder="Search name or email"
                    value={searchQuery}
                    size="medium"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onClear={() => applyFilterChange(() => setSearchQuery(""))}
                    onSubmit={() => {}}
                  />
                  <FilterField
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
                  {/* Disabled: module filter — see file header comment.
                  <FilterField
                    label="Module"
                    size="medium"
                    value={moduleFilter}
                    options={moduleOptions}
                    onChange={(event) =>
                      applyFilterChange(() =>
                        setModuleFilter(String(event.target.value)),
                      )
                    }
                  />
                  */}
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

              {/* Disabled: bulk selection bar — see file header comment.
              <BulkBar>
                <BulkLabel>
                  <MuiCheckbox
                    size="small"
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onChange={toggleSelectAll}
                    inputProps={{
                      "aria-label": "Select all learners on this page",
                    }}
                  />
                  Select all
                </BulkLabel>
                <Button
                  size="small"
                  variant="bordered"
                  disabled={selected.size === 0}
                  onClick={() => sendReminder([...selected])}
                >
                  Send reminder
                </Button>
              </BulkBar>
              */}

              {withheldCount > 0 ? (
                <ConsentNotice component="p">
                  {withheldCount} of these {filteredCount} enrollments belong to
                  learners who have not agreed to share their progress. Their
                  status, grade and activity read “No consent given”.
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
                      {/* Disabled: selection column header — see file header comment.
                      <SelectHeaderCell
                        role="columnheader"
                        aria-label="Select"
                      />
                      */}
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
                      {/* Disabled: fabricated Progress column header — see
                          LearnerRow.tsx's "Disabled:" comment.
                      <TableHeaderCell
                        role="columnheader"
                        $flex={COLUMN_FLEX.progress}
                      >
                        Progress
                      </TableHeaderCell>
                      */}
                      {/* Disabled: fabricated Last activity column header —
                          see LearnerRow.tsx's "Disabled:" comment.
                      <TableHeaderCell
                        role="columnheader"
                        $flex={COLUMN_FLEX.lastActivity}
                      >
                        Last activity
                      </TableHeaderCell>
                      */}
                      {/* Disabled: action column header — see file header comment.
                      <ActionHeaderCell
                        role="columnheader"
                        aria-label="Actions"
                      />
                      */}
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
                          aria-colspan={2}
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

              {/* Disabled: nothing fabricated currently renders on screen —
                  Progress, Last activity and "Needs attention" are all
                  commented out above — so this footnote has nothing left to
                  disclose. Restore alongside whichever placeholder returns
                  to view first.
              <PlaceholderNotice component="p">
                Last activity is a preview value and is not yet real data.
              </PlaceholderNotice>
              */}
            </ResultsSection>
          </>
        )}
      </Stack>
    </Page>
  )
}

const ContractLearnersPage: React.FC<ContractLearnersPageProps> = (props) => {
  const flagsLoaded = useFeatureFlagsLoaded()
  const enabled = useFeatureFlagEnabled(FeatureFlags.B2BAnalyticsDashboard)

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
