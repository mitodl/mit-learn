import React from "react"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Stack,
  styled,
  Typography,
} from "ol-components"
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
import { EnrollmentStatusIndicator } from "./EnrollmentStatusIndicator"
import NextLink from "next/link"
import { CourseRunEnrollmentV3 } from "@mitodl/mitxonline-api-axios/v2"

const AdditionalRunsAccordion = styled(Accordion)(({ theme }) => ({
  boxShadow: "none",
  "&:before": { display: "none" },
  backgroundColor: theme.custom.colors.white,
  "& .MuiAccordionSummary-content": {
    minWidth: 0,
    overflow: "hidden",
  },
  "& .MuiAccordionSummary-root": {
    [theme.breakpoints.down("md")]: {
      padding: 0,
    },
  },
}))

const CurrentRunIcon = styled.div(({ theme }) => ({
  width: "8px",
  height: "8px",
  backgroundColor: theme.custom.colors.green,
  flexShrink: 0,
}))

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

const ExpandChevron = styled(RiArrowDownSLine)(({ theme }) => ({
  width: "16px",
  height: "16px",
  color: theme.custom.colors.silverGrayDark,
  flexShrink: 0,
}))

const ViewContentArrow = styled(RiArrowRightSLine)(({ theme }) => ({
  width: "16px",
  height: "16px",
  color: theme.custom.colors.red,
  flexShrink: 0,
}))

const CourseRunsCountText = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.red,
  textDecoration: "underline",
  flexShrink: 0,
  whiteSpace: "nowrap",
}))

const DateRangeStack = styled(Stack)({
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
})

const RunsAccordionDetails = styled(AccordionDetails)({
  padding: 0,
})

const SummaryRow = styled(Stack)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  gap: "24px",
  [theme.breakpoints.down("md")]: {
    gap: "8px",
  },
}))

const RunsListWrapper = styled.div(({ theme }) => ({
  padding: "0 16px 16px",
  [theme.breakpoints.down("md")]: {
    padding: "0 0 8px",
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

type SiblingRunsAccordionProps = {
  /** The currently displayed enrollment (shown in the summary bar). */
  enrollment: CourseRunEnrollmentV3
  /**
   * Other enrollments for the same course variant, pre-filtered to exclude
   * the current enrollment. Each entry becomes a row in the expanded list.
   */
  siblingEnrollments: CourseRunEnrollmentV3[]
}

const SiblingRunsAccordion: React.FC<SiblingRunsAccordionProps> = ({
  enrollment,
  siblingEnrollments,
}) => {
  const [expanded, setExpanded] = React.useState(false)
  const run = enrollment.run
  const enrollmentStatus = getDashboardEnrollmentStatus({
    type: DashboardType.CourseRunEnrollment,
    data: enrollment,
  })

  return (
    <AdditionalRunsAccordion
      expanded={expanded}
      disableGutters
      onChange={(_e, isExpanded) => setExpanded(isExpanded)}
    >
      <AccordionSummary expandIcon={<ExpandChevron />}>
        <SummaryRow direction="row" alignItems="flex-end">
          <DateRangeStack direction="row" alignItems="center" gap="4px">
            <CurrentRunIcon aria-hidden="true" />
            <Typography variant="body3" color="darkGray2" noWrap>
              Current run:
            </Typography>
            <Typography variant="body3" color="silverGrayDark" noWrap>
              {formatRunDateRange(run?.start_date, run?.end_date)}
              {getRunStatusLabel(enrollmentStatus)
                ? ` (${getRunStatusLabel(enrollmentStatus)})`
                : ""}
            </Typography>
          </DateRangeStack>
          <CourseRunsCountText>
            Course runs ({siblingEnrollments.length + 1})
          </CourseRunsCountText>
        </SummaryRow>
      </AccordionSummary>
      <RunsAccordionDetails>
        <RunsListWrapper>
          <RunsListBox>
            {siblingEnrollments.map((e, i) => {
              const startDate = e.run?.start_date
              const endDate = e.run?.end_date
              const isUpcoming = startDate && !isInPast(startDate)
              const isExpired = endDate && isInPast(endDate)
              const runLabel = isUpcoming
                ? `Upcoming: ${formatRunDateRange(startDate, endDate)}`
                : formatRunDateRange(startDate, endDate)
              const runEnrollmentStatus = getDashboardEnrollmentStatus({
                type: DashboardType.CourseRunEnrollment,
                data: e,
              })
              const coursewareUrl = e.run?.courseware_url
              return (
                <RunRow key={e.id} isFirst={i === 0}>
                  <Stack
                    direction="row"
                    gap="8px"
                    alignItems="center"
                    flex={1}
                    minWidth={0}
                  >
                    {isUpcoming ? (
                      <UpcomingRunIcon />
                    ) : isExpired ? (
                      <ExpiredRunIcon />
                    ) : (
                      <EnrollmentStatusIndicator
                        status={runEnrollmentStatus}
                        showNotComplete
                      />
                    )}
                    <Typography variant="subtitle3" color="darkGray2" noWrap>
                      {runLabel}
                    </Typography>
                  </Stack>
                  {coursewareUrl && (
                    <Stack
                      direction="row"
                      gap="4px"
                      alignItems="center"
                      flexShrink={0}
                    >
                      <ViewContentLink
                        href={coursewareUrl}
                        aria-label={`View content for ${runLabel}`}
                      >
                        View content
                      </ViewContentLink>
                      <ViewContentArrow />
                    </Stack>
                  )}
                </RunRow>
              )
            })}
          </RunsListBox>
        </RunsListWrapper>
      </RunsAccordionDetails>
    </AdditionalRunsAccordion>
  )
}

export { SiblingRunsAccordion }
