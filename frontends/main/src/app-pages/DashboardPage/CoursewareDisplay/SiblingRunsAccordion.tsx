import React from "react"
import { Collapse, SimpleMenu, Stack, styled, Typography } from "ol-components"
import {
  DashboardType,
  EnrollmentStatus,
  getDashboardEnrollmentStatus,
} from "./model/dashboardViewModel"
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiMore2Line,
  RiSubtractLine,
  RiTimeLine,
} from "@remixicon/react"
import { formatRunIdentifier, getRunTimeState } from "./courseDateUtils"
import type { RunTimeState } from "./courseDateUtils"
import { ActionButton, VisuallyHidden } from "@mitodl/smoot-design"
import { EnrollmentStatusIcon } from "./EnrollmentStatus"
import NextLink from "next/link"
import { CourseRunEnrollmentV3 } from "@mitodl/mitxonline-api-axios/v2"
import { useOrderIdForRun } from "@/common/mitxonline/useOrderIdForResource"
import { getRunMenuItems } from "./runMenuItems"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"

const UpcomingRunIcon = styled(RiTimeLine)(({ theme }) => ({
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  color: theme.custom.colors.white,
  backgroundColor: theme.custom.colors.orange,
  flexShrink: 0,
}))

const ExpiredRunIcon = styled(RiSubtractLine)(({ theme }) => ({
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  border: `1px solid ${theme.custom.colors.silverGray}`,
  color: theme.custom.colors.silverGray,
  flexShrink: 0,
}))

const RunsListBox = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  overflow: "hidden",
  width: "100%",
}))

const RunRow = styled.div<{ isFirst: boolean }>(({ theme, isFirst }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "4px",
  padding: "16px",
  borderTop: isFirst ? "none" : `1px solid ${theme.custom.colors.lightGray2}`,
}))

const ViewContentLink = styled(NextLink)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.mitRed,
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
}))

const ViewContentArrow = styled(RiArrowRightSLine)(({ theme }) => ({
  width: "16px",
  height: "16px",
  color: theme.custom.colors.red,
  flexShrink: 0,
}))

const CourseRunsCountText = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  flexShrink: 0,
  whiteSpace: "nowrap",
}))

const ExpandChevron = styled(RiArrowDownSLine, {
  shouldForwardProp: (prop) => prop !== "expanded",
})<{ expanded: boolean }>(({ theme, expanded }) => ({
  width: "16px",
  height: "16px",
  color: theme.custom.colors.silverGrayDark,
  flexShrink: 0,
  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
  transition: "transform 0.2s ease",
}))

const ToggleButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  "&:hover .course-runs-count-text": {
    color: theme.custom.colors.mitRed,
    textDecoration: "underline",
  },
}))

const RunLabelPrefix = styled(Typography)({
  flexShrink: 0,
})

const RunLabelValue = styled(Typography)({
  flex: 1,
  minWidth: 0,
})

const RunsListWrapper = styled.div(({ theme }) => ({
  padding: "0 16px 16px",
  [theme.breakpoints.down("sm")]: {
    padding: "8px 0",
  },
}))

/**
 * Every state gets words, not just "In Progress". The run icons are
 * `aria-hidden`, so anything conveyed only by an icon is silent to a screen
 * reader; this label is the sole status text on the row.
 *
 * "Upcoming" rather than the badge's "Not Started" because the sibling rows in
 * this same list already prefix future runs with "Upcoming:".
 */
const getRunStatusLabel = (
  status: EnrollmentStatus,
  timeState: RunTimeState,
): string => {
  if (status === EnrollmentStatus.Completed) return "Completed"
  if (timeState === "upcoming") return "Upcoming"
  if (timeState === "ended") return "Ended"
  if (status === EnrollmentStatus.Enrolled) return "In Progress"
  return ""
}

type SiblingRunsToggleProps = {
  /** Total number of runs, including the currently displayed one. */
  runCount: number
  expanded: boolean
  onClick: () => void
  /** id of this toggle button, referenced by the panel's aria-labelledby. */
  id?: string
  /** id of the SiblingRunsPanel this toggle controls. */
  controls?: string
}

const SiblingRunsToggle: React.FC<SiblingRunsToggleProps> = ({
  runCount,
  expanded,
  onClick,
  id,
  controls,
}) => (
  <ToggleButton
    type="button"
    id={id}
    onClick={onClick}
    aria-expanded={expanded}
    aria-controls={controls}
  >
    <CourseRunsCountText className="course-runs-count-text">
      Course runs ({runCount})
    </CourseRunsCountText>
    <ExpandChevron expanded={expanded} aria-hidden="true" />
  </ToggleButton>
)

type RunListRowProps = {
  icon: React.ReactNode
  /** Bold lead-in, e.g. "Current run:" or "Upcoming:". Omitted for plain past runs. */
  labelPrefix?: string
  labelValue: string
  /**
   * The row's full run label, e.g. "Upcoming: Jan 5, 2026". Both of the row's
   * controls take their accessible name from it: "View content" and the menu
   * trigger repeat on every row, so the run is the only thing telling them
   * apart.
   */
  runLabel: string
  enrollment: CourseRunEnrollmentV3
  isFirst: boolean
}

const RunListRow: React.FC<RunListRowProps> = ({
  icon,
  labelPrefix,
  labelValue,
  runLabel,
  enrollment,
  isFirst,
}) => {
  const coursewareUrl = enrollment.run?.courseware_url
  /**
   * Resolved per row so each run's Receipt item reflects that run's own order.
   * Every row shares the one `orders/history` query, so N rows still cost a
   * single request and the per-row work is a client-side lookup.
   */
  const receiptResolution = useOrderIdForRun(enrollment.run.id)
  const perRunMenusEnabled = useFeatureFlagEnabled(
    FeatureFlags.MultipleRunContextMenus,
  )
  const menuItems = getRunMenuItems({
    enrollment,
    title: enrollment.run.course.title,
    receiptResolution,
  })
  return (
    <RunRow isFirst={isFirst}>
      <Stack
        direction="row"
        gap="8px"
        alignItems="center"
        flex={1}
        minWidth={0}
      >
        {icon}
        <Stack
          direction="row"
          gap="4px"
          alignItems="center"
          flex={1}
          minWidth={0}
        >
          {labelPrefix && (
            <RunLabelPrefix variant="subtitle3" color="darkGray2" noWrap>
              {labelPrefix}
            </RunLabelPrefix>
          )}
          <RunLabelValue
            variant={labelPrefix ? "body3" : "subtitle3"}
            color={labelPrefix ? "silverGrayDark" : "darkGray2"}
            noWrap
          >
            {labelValue}
          </RunLabelValue>
        </Stack>
      </Stack>
      <Stack direction="row" gap="4px" alignItems="center" flexShrink={0}>
        {coursewareUrl && (
          <>
            <ViewContentLink
              href={coursewareUrl}
              aria-label={`View content for ${runLabel}`}
            >
              View content
            </ViewContentLink>
            <ViewContentArrow aria-hidden="true" />
          </>
        )}
        {perRunMenusEnabled && (
          <SimpleMenu
            items={menuItems}
            // Every row's menu is otherwise just "menu" to a screen reader.
            menuOverrideProps={{
              MenuListProps: { "aria-label": `Options for ${runLabel}` },
            }}
            trigger={
              <ActionButton
                size="small"
                variant="text"
                aria-label={`More options for ${runLabel}`}
              >
                <RiMore2Line aria-hidden="true" />
              </ActionButton>
            }
          />
        )}
      </Stack>
    </RunRow>
  )
}

type SiblingRunsPanelProps = {
  /** The currently displayed enrollment (shown above the sibling list). */
  enrollment: CourseRunEnrollmentV3
  /**
   * Other enrollments for the same course variant, pre-filtered to exclude
   * the current enrollment. Each entry becomes a row in the list.
   */
  siblingEnrollments: CourseRunEnrollmentV3[]
  expanded: boolean
  /** id referenced by the SiblingRunsToggle controlling this panel. */
  id?: string
  /** id of the SiblingRunsToggle that labels this panel. */
  labelledBy?: string
}

const SiblingRunsPanel: React.FC<SiblingRunsPanelProps> = ({
  enrollment,
  siblingEnrollments,
  expanded,
  id,
  labelledBy,
}) => {
  const currentRun = enrollment.run
  const currentStatus = getDashboardEnrollmentStatus({
    type: DashboardType.CourseRunEnrollment,
    data: enrollment,
  })
  const currentTimeState = getRunTimeState(
    currentRun?.start_date,
    currentRun?.end_date,
  )
  const currentStatusLabel = getRunStatusLabel(currentStatus, currentTimeState)
  const currentRunIdentifier = formatRunIdentifier(currentRun)
  const currentLabelValue = currentStatusLabel
    ? `${currentRunIdentifier} (${currentStatusLabel})`
    : currentRunIdentifier
  const currentRunLabel = `Current run: ${currentLabelValue}`

  return (
    <Collapse
      in={expanded}
      id={id}
      mountOnEnter
      unmountOnExit
      role="region"
      aria-labelledby={labelledBy}
    >
      <RunsListWrapper>
        <RunsListBox>
          <RunListRow
            isFirst
            icon={
              currentStatus === EnrollmentStatus.Completed ? (
                <EnrollmentStatusIcon status={currentStatus} />
              ) : currentTimeState === "upcoming" ? (
                <UpcomingRunIcon aria-hidden="true" />
              ) : currentTimeState === "ended" ? (
                <ExpiredRunIcon aria-hidden="true" />
              ) : (
                <EnrollmentStatusIcon status={currentStatus} />
              )
            }
            labelPrefix="Current run:"
            labelValue={currentLabelValue}
            runLabel={currentRunLabel}
            enrollment={enrollment}
          />
          {siblingEnrollments.map((e) => {
            const startDate = e.run?.start_date
            const endDate = e.run?.end_date
            const runEnrollmentStatus = getDashboardEnrollmentStatus({
              type: DashboardType.CourseRunEnrollment,
              data: e,
            })
            /**
             * Status outranks the calendar, as it does in getRunStatusLabel
             * for the current run. A completed run has necessarily ended, so
             * checking the dates first meant "Ended" always won and a passed
             * run could never show as completed.
             */
            const isCompleted =
              runEnrollmentStatus === EnrollmentStatus.Completed
            const timeState = getRunTimeState(startDate, endDate)
            const isUpcoming = !isCompleted && timeState === "upcoming"
            const isExpired = !isCompleted && timeState === "ended"
            const runIdentifier = formatRunIdentifier(e.run)
            const fullLabel = isCompleted
              ? `${runIdentifier} (Completed)`
              : isUpcoming
                ? `Upcoming: ${runIdentifier}`
                : isExpired
                  ? `${runIdentifier} (Ended)`
                  : runIdentifier
            return (
              <RunListRow
                key={e.id}
                isFirst={false}
                icon={
                  isUpcoming ? (
                    // The visible "Upcoming:" prefix already says this.
                    <UpcomingRunIcon aria-hidden="true" />
                  ) : isExpired ? (
                    <>
                      <ExpiredRunIcon aria-hidden="true" />
                      {/* A past sibling row shows only a date range, so
                          without this the icon is the only thing saying the
                          run is over and screen readers get nothing. */}
                      <VisuallyHidden>Ended</VisuallyHidden>
                    </>
                  ) : (
                    <EnrollmentStatusIcon status={runEnrollmentStatus} />
                  )
                }
                labelPrefix={isUpcoming ? "Upcoming:" : undefined}
                labelValue={runIdentifier}
                runLabel={fullLabel}
                enrollment={e}
              />
            )
          })}
        </RunsListBox>
      </RunsListWrapper>
    </Collapse>
  )
}

export { SiblingRunsToggle, SiblingRunsPanel }
