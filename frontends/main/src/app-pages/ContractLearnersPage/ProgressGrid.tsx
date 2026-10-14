"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  RiAwardLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiLockLine,
  RiProgress4Line,
  RiQuestionLine,
  RiSubtractLine,
  RiUserLine,
} from "@remixicon/react"
import {
  alpha,
  Pagination,
  Skeleton,
  styled,
  Tooltip,
  Typography,
} from "ol-components"
import { Alert, Button, VisuallyHidden } from "@mitodl/smoot-design"
import { initials } from "ol-utilities"
import {
  analyticsContractQueries,
  type CompletionStatusFilter,
  type CourseRun,
  type LearnerWithEnrollments,
} from "api/analytics-hooks/organizations"
import {
  EmptyTableMessage,
  TableCard,
  TableFooter,
  TableFootnote,
} from "@/components/B2BTable/B2BTable"
import { Avatar, NeedsAttentionBadge } from "./LearnerRow"
import {
  DISPLAY_STATUS_LABEL,
  getDisplayStatus,
  type DisplayStatus,
} from "./statusDisplay"

/** The `/learners` endpoint's maximum page size, in learners. */
const PAGE_SIZE = 25

const LEARNER_COLUMN_WIDTH = 280
const MODULE_COLUMN_WIDTH = 160

type MarkTone = "green" | "blue" | "gray"

const STATUS_SYMBOL: Record<
  DisplayStatus,
  { Icon: React.ElementType; tone: MarkTone }
> = {
  completed: { Icon: RiCheckLine, tone: "green" },
  certificate: { Icon: RiAwardLine, tone: "green" },
  "in-progress": { Icon: RiProgress4Line, tone: "blue" },
  "not-started": { Icon: RiSubtractLine, tone: "gray" },
  "not-shared": { Icon: RiLockLine, tone: "gray" },
  unknown: { Icon: RiQuestionLine, tone: "gray" },
}

/**
 * The API flags an enrollment that was never started or whose last activity
 * was 30 or more days ago; the status says which of the two it was.
 */
const attentionReason = (status: DisplayStatus) =>
  status === "not-started" ? "Not started" : "No activity in 30+ days"

const LEGEND_STATUSES: DisplayStatus[] = [
  "completed",
  "certificate",
  "in-progress",
  "not-started",
  "not-shared",
]

const ScrollRegion = styled.div({
  position: "relative",
  overflowX: "auto",
})

const Grid = styled.div({
  display: "flex",
  flexDirection: "column",
})

const GridRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  borderBottom: `1px solid ${theme.custom.colors.silverGrayLight}`,
  "&:last-child": { borderBottom: "none" },
}))

const HeaderRow = styled(GridRow)(({ theme }) => ({
  borderBottom: `1px solid ${theme.custom.colors.silverGrayDark}`,
  alignItems: "flex-end",
}))

const cellStyles = {
  padding: "14px 8px",
  boxSizing: "border-box",
  flex: "none",
} as const

const LearnerCell = styled("div", {
  shouldForwardProp: (prop) => prop !== "$scrolled",
})<{ $scrolled: boolean }>(({ $scrolled, theme }) => ({
  ...cellStyles,
  width: `${LEARNER_COLUMN_WIDTH}px`,
  position: "sticky",
  left: 0,
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: "12px",
  backgroundColor: theme.custom.colors.white,
  borderRight: `1px solid ${theme.custom.colors.lightGray2}`,
  boxShadow: $scrolled
    ? `4px 0 6px -3px ${alpha(theme.custom.colors.darkGray2, 0.18)}`
    : "none",
}))

const ModuleCell = styled.div(({ theme }) => ({
  ...cellStyles,
  paddingLeft: "20px",
  width: `${MODULE_COLUMN_WIDTH}px`,
  ...theme.typography.body2,
  color: theme.custom.colors.black,
}))

const HeaderLearnerCell = styled(LearnerCell)(({ theme }) => ({
  alignSelf: "stretch",
  alignItems: "flex-end",
  ...theme.typography.subtitle2,
  color: theme.custom.colors.black,
}))

const HeaderModuleCell = styled(ModuleCell)(({ theme }) => ({
  padding: 0,
  paddingLeft: "20px",
  ...theme.typography.subtitle2,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
  overflow: "hidden",
}))

const LearnerName = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.black,
  overflow: "hidden",
  textOverflow: "ellipsis",
})) as typeof Typography

const LearnerEmail = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  overflow: "hidden",
  textOverflow: "ellipsis",
})) as typeof Typography

const LearnerText = styled.span({
  minWidth: 0,
  overflow: "hidden",
})

const AttentionMark = styled.span(({ theme }) => ({
  display: "inline-flex",
  verticalAlign: "middle",
  marginLeft: "6px",
  color: theme.custom.colors.red,
}))

const StatusMark = styled.span<{ $tone: MarkTone }>(({ $tone, theme }) => ({
  display: "inline-flex",
  verticalAlign: "middle",
  color:
    $tone === "green"
      ? theme.custom.colors.darkGreen
      : $tone === "blue"
        ? theme.custom.colors.darkBlue
        : theme.custom.colors.silverGrayDark,
}))

const Legend = styled.ul(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 20px",
  margin: "0 0 16px",
  padding: 0,
  listStyle: "none",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  "& li": { display: "inline-flex", alignItems: "center", gap: "6px" },
}))

const Muted = styled.span(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

type ProgressGridProps = {
  orgUuid: string
  contractId: string
  search: string
  completionStatus: CompletionStatusFilter[] | undefined
  needsAttentionOnly: boolean
  /** From the page's own course-runs query: one grid column per run. */
  courseRuns: CourseRun[] | undefined
  courseRunsFailed: boolean
  courseRunsFetching: boolean
  onRetryCourseRuns: () => void
  page: number
  onPageChange: (page: number) => void
  emptyMessage: string
}

const GridLearnerCell: React.FC<{
  learner: LearnerWithEnrollments
  needsAttentionCount: number
  scrolled: boolean
}> = ({ learner, needsAttentionCount, scrolled }) => (
  <LearnerCell role="rowheader" $scrolled={scrolled}>
    <Avatar aria-hidden="true">
      {learner.full_name ? (
        initials(learner.full_name)
      ) : (
        <RiUserLine size={16} />
      )}
    </Avatar>
    <LearnerText>
      {learner.full_name && (
        <LearnerName component="div">{learner.full_name}</LearnerName>
      )}
      {learner.email && (
        <LearnerEmail component="div">{learner.email}</LearnerEmail>
      )}
      {needsAttentionCount > 0 ? (
        <NeedsAttentionBadge
          component="span"
          label={`Needs attention in ${needsAttentionCount} ${
            needsAttentionCount === 1 ? "module" : "modules"
          }`}
        />
      ) : null}
    </LearnerText>
  </LearnerCell>
)

/** The cell's symbol, with its label for assistive tech and on hover. */
const StatusSymbol: React.FC<{ status: DisplayStatus }> = ({ status }) => {
  const { Icon, tone } = STATUS_SYMBOL[status]
  const label = DISPLAY_STATUS_LABEL[status]
  return (
    <Tooltip title={label}>
      <StatusMark $tone={tone}>
        <Icon aria-hidden="true" size={20} />
        <VisuallyHidden>{label}</VisuallyHidden>
      </StatusMark>
    </Tooltip>
  )
}

/** The title is clamped to three lines; only then is it focusable and given a tooltip with the full name. */
const ModuleHeader: React.FC<{ title: string }> = ({ title }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [truncated, setTruncated] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (el) setTruncated(el.scrollHeight > el.clientHeight)
  }, [title])
  return (
    <Tooltip title={truncated ? title : ""}>
      <HeaderModuleCell
        ref={ref}
        role="columnheader"
        tabIndex={truncated ? 0 : undefined}
      >
        {title}
      </HeaderModuleCell>
    </Tooltip>
  )
}

const ProgressGrid: React.FC<ProgressGridProps> = ({
  orgUuid,
  contractId,
  search,
  completionStatus,
  needsAttentionOnly,
  courseRuns,
  courseRunsFailed,
  courseRunsFetching,
  onRetryCourseRuns,
  page,
  onPageChange,
  emptyMessage,
}) => {
  const filters = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(completionStatus ? { completion_status: completionStatus } : {}),
      ...(needsAttentionOnly ? { needs_attention: true } : {}),
    }),
    [search, completionStatus, needsAttentionOnly],
  )

  const query = useQuery({
    ...analyticsContractQueries.learners(orgUuid, contractId, {
      ...filters,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  })

  const learners = useMemo(
    () =>
      (query.data?.data ?? []).map((learner) => ({
        learner,
        enrollments: new Map(
          learner.enrollments.map((enrollment) => [
            enrollment.courserun_readable_id,
            enrollment,
          ]),
        ),
        needsAttentionCount: learner.enrollments.filter(
          (enrollment) => enrollment.needs_attention,
        ).length,
      })),
    [query.data],
  )
  const totalPages = Math.ceil((query.data?.total_count ?? 0) / PAGE_SIZE)
  const isStale = query.isPlaceholderData || query.isFetching
  const isBusy = query.isLoading || isStale

  useEffect(() => {
    if (!isBusy && totalPages > 0 && page > totalPages) {
      onPageChange(totalPages)
    }
  }, [isBusy, page, totalPages, onPageChange])

  const [scrolled, setScrolled] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const lastFilters = useRef<string | null>(null)
  useEffect(() => {
    if (isBusy || !query.data) return
    const key = JSON.stringify(filters)
    const total = query.data.total_count
    const pageText = `Page ${page} of ${Math.max(totalPages, 1)}`
    setAnnouncement(
      lastFilters.current !== null && lastFilters.current !== key
        ? `${total} ${total === 1 ? "learner" : "learners"}. ${pageText}`
        : `Showing ${pageText.toLowerCase()}`,
    )
    lastFilters.current = key
  }, [isBusy, query.data, filters, page, totalPages])

  const hasError = query.isError || courseRunsFailed
  const isRetrying = query.isFetching || courseRunsFetching

  const regionRef = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef(false)
  useEffect(() => {
    if (!restoreFocus.current || isRetrying) return
    restoreFocus.current = false
    if (!hasError) regionRef.current?.focus()
  }, [hasError, isRetrying])
  const liveMessage = query.isLoading
    ? "Loading learners"
    : hasError
      ? isRetrying
        ? "Loading learners"
        : "Something went wrong loading learner data."
      : learners.length === 0
        ? emptyMessage
        : announcement

  const liveRegion = (
    <VisuallyHidden role="status" aria-atomic="true">
      {liveMessage}
    </VisuallyHidden>
  )

  if (hasError) {
    return (
      <>
        {liveRegion}
        <Alert severity="error">
          Something went wrong loading learner data.{" "}
          <Button
            size="small"
            variant="bordered"
            aria-busy={isRetrying}
            onClick={() => {
              if (isRetrying) return
              restoreFocus.current = true
              if (query.isError) query.refetch()
              if (courseRunsFailed) onRetryCourseRuns()
            }}
          >
            {isRetrying ? "Retrying…" : "Try again"}
          </Button>
        </Alert>
      </>
    )
  }

  const columns = courseRuns ?? []
  const width = LEARNER_COLUMN_WIDTH + columns.length * MODULE_COLUMN_WIDTH

  return (
    <>
      {liveRegion}

      <TableCard>
        <Legend aria-label="Legend">
          {LEGEND_STATUSES.map((status) => (
            <li key={status}>
              <StatusMark $tone={STATUS_SYMBOL[status].tone}>
                {React.createElement(STATUS_SYMBOL[status].Icon, {
                  "aria-hidden": true,
                  size: 18,
                })}
              </StatusMark>
              {DISPLAY_STATUS_LABEL[status]}
            </li>
          ))}
          <li>
            <Muted>N/A</Muted>
            Not enrolled
          </li>
          <li>
            <AttentionMark style={{ margin: 0 }}>
              <RiErrorWarningLine aria-hidden="true" size={18} />
            </AttentionMark>
            Needs attention
          </li>
        </Legend>
        <ScrollRegion
          ref={regionRef}
          role="region"
          aria-label="Learner progress by module, scrolls horizontally"
          tabIndex={0}
          onScroll={(event) => setScrolled(event.currentTarget.scrollLeft > 0)}
        >
          <Grid
            role="table"
            aria-label="Learner progress by module"
            aria-busy={isBusy}
            style={{ minWidth: width }}
          >
            <div role="rowgroup">
              <HeaderRow role="row">
                <HeaderLearnerCell role="columnheader" $scrolled={scrolled}>
                  Learner
                </HeaderLearnerCell>
                {columns.map((run) => (
                  <ModuleHeader
                    key={run.courserun_id}
                    title={run.courserun_title}
                  />
                ))}
              </HeaderRow>
            </div>
            <div
              role="rowgroup"
              style={{
                opacity: isStale ? 0.5 : 1,
                transition: isStale ? "opacity 150ms ease 150ms" : "none",
              }}
            >
              {query.isLoading || !courseRuns ? (
                [1, 2, 3].map((key) => (
                  <GridRow key={key} role="row">
                    <div role="cell" style={{ width: "100%" }}>
                      <Skeleton width="100%" height="48px" />
                    </div>
                  </GridRow>
                ))
              ) : learners.length === 0 ? (
                <GridRow role="row">
                  <EmptyTableMessage
                    component="div"
                    role="cell"
                    aria-colspan={columns.length + 1}
                    style={{ width: "100%" }}
                  >
                    {emptyMessage}
                  </EmptyTableMessage>
                </GridRow>
              ) : (
                learners.map(
                  ({ learner, enrollments, needsAttentionCount }) => (
                    <GridRow key={learner.learner_id} role="row">
                      <GridLearnerCell
                        learner={learner}
                        needsAttentionCount={needsAttentionCount}
                        scrolled={scrolled}
                      />
                      {columns.map((run) => {
                        const enrollment = enrollments.get(run.courserun_id)
                        if (!enrollment) {
                          return (
                            <ModuleCell key={run.courserun_id} role="cell">
                              <Muted>
                                N/A
                                <VisuallyHidden>, not enrolled</VisuallyHidden>
                              </Muted>
                            </ModuleCell>
                          )
                        }
                        const status = getDisplayStatus(enrollment)
                        return (
                          <ModuleCell key={run.courserun_id} role="cell">
                            <StatusSymbol status={status} />
                            {enrollment.needs_attention ? (
                              <Tooltip title={attentionReason(status)}>
                                <AttentionMark tabIndex={0}>
                                  <RiErrorWarningLine
                                    aria-hidden="true"
                                    size={16}
                                  />
                                  <VisuallyHidden>
                                    , needs attention: {attentionReason(status)}
                                  </VisuallyHidden>
                                </AttentionMark>
                              </Tooltip>
                            ) : null}
                          </ModuleCell>
                        )
                      })}
                    </GridRow>
                  ),
                )
              )}
            </div>
          </Grid>
        </ScrollRegion>
        <TableFooter>
          <TableFootnote component="p">
            {learners.length > 0
              ? `Page ${page} of ${Math.max(totalPages, 1)}`
              : ""}
          </TableFootnote>
          {totalPages > 1 ? (
            <Pagination
              count={totalPages}
              page={page}
              shape="rounded"
              size="small"
              onChange={(_event, value) => onPageChange(value)}
            />
          ) : null}
        </TableFooter>
      </TableCard>
    </>
  )
}

export { ProgressGrid }
