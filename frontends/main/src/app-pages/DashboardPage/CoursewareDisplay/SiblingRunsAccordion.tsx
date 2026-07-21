import React from "react"
import { Collapse, Stack, styled, Typography } from "ol-components"
import {
  DashboardType,
  EnrollmentStatus,
  getDashboardEnrollmentStatus,
} from "./model/dashboardViewModel"
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiSubtractLine,
  RiTimeLine,
} from "@remixicon/react"
import { isInPast, formatDate } from "ol-utilities"
import { EnrollmentStatusIcon } from "./EnrollmentStatus"
import NextLink from "next/link"
import { CourseRunEnrollmentV3 } from "@mitodl/mitxonline-api-axios/v2"

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

const formatRunDateRange = (
  startDate?: string | null,
  endDate?: string | null,
): string => {
  const parts: string[] = []
  if (startDate) parts.push(formatDate(startDate, "MMM D, YYYY"))
  if (endDate) parts.push(formatDate(endDate, "MMM D, YYYY"))
  return parts.join(" – ")
}

const getRunStatusLabel = (status: EnrollmentStatus): string => {
  if (status === EnrollmentStatus.Completed) return "Completed"
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
  coursewareUrl?: string | null
  ariaLabel: string
  isFirst: boolean
}

const RunListRow: React.FC<RunListRowProps> = ({
  icon,
  labelPrefix,
  labelValue,
  coursewareUrl,
  ariaLabel,
  isFirst,
}) => (
  <RunRow isFirst={isFirst}>
    <Stack direction="row" gap="8px" alignItems="center" flex={1} minWidth={0}>
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
    {coursewareUrl && (
      <Stack direction="row" gap="4px" alignItems="center" flexShrink={0}>
        <ViewContentLink href={coursewareUrl} aria-label={ariaLabel}>
          View content
        </ViewContentLink>
        <ViewContentArrow />
      </Stack>
    )}
  </RunRow>
)

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
  const currentStatusLabel = getRunStatusLabel(currentStatus)
  const currentDateRange = formatRunDateRange(
    currentRun?.start_date,
    currentRun?.end_date,
  )
  const currentLabelValue = currentStatusLabel
    ? `${currentDateRange} (${currentStatusLabel})`
    : currentDateRange

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
            icon={<EnrollmentStatusIcon status={currentStatus} />}
            labelPrefix="Current run:"
            labelValue={currentLabelValue}
            coursewareUrl={currentRun?.courseware_url}
            ariaLabel={`View content for Current run: ${currentLabelValue}`}
          />
          {siblingEnrollments.map((e) => {
            const startDate = e.run?.start_date
            const endDate = e.run?.end_date
            const isUpcoming = startDate && !isInPast(startDate)
            const isExpired = endDate && isInPast(endDate)
            const dateRange = formatRunDateRange(startDate, endDate)
            const fullLabel = isUpcoming ? `Upcoming: ${dateRange}` : dateRange
            const runEnrollmentStatus = getDashboardEnrollmentStatus({
              type: DashboardType.CourseRunEnrollment,
              data: e,
            })
            const coursewareUrl = e.run?.courseware_url
            return (
              <RunListRow
                key={e.id}
                isFirst={false}
                icon={
                  isUpcoming ? (
                    <UpcomingRunIcon aria-hidden="true" />
                  ) : isExpired ? (
                    <ExpiredRunIcon aria-hidden="true" />
                  ) : (
                    <EnrollmentStatusIcon status={runEnrollmentStatus} />
                  )
                }
                labelPrefix={isUpcoming ? "Upcoming:" : undefined}
                labelValue={dateRange}
                coursewareUrl={coursewareUrl}
                ariaLabel={`View content for ${fullLabel}`}
              />
            )
          })}
        </RunsListBox>
      </RunsListWrapper>
    </Collapse>
  )
}

export { SiblingRunsToggle, SiblingRunsPanel }
