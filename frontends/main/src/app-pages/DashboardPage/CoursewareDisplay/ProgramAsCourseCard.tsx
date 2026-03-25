import React from "react"
import { Link, Popover, Stack, Typography, styled } from "ol-components"
import {
  CourseRunEnrollmentV3,
  CourseWithCourseRunsSerializerV2,
  V3UserProgramEnrollment,
  V2ProgramRequirement,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  EnrollmentStatus,
  getEnrollmentStatus,
  getKey,
  getProgramEnrollmentStatus,
  ResourceType,
  selectBestEnrollment,
} from "./helpers"
import { ProgressBadge } from "./ProgressBadge"
import {
  DashboardCard as ModuleCard,
  DashboardType as ModuleCardType,
} from "./ModuleCard"
import { formatDate } from "ol-utilities"
import { getIdsFromReqTree } from "@/common/mitxonline"

const ProgramCardRoot = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "stretch",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderBottom: "none",
  backgroundColor: theme.custom.colors.white,
  boxShadow: "0 1px 3px 0 rgba(120, 147, 172, 0.20)",
  [theme.breakpoints.down("md")]: {
    border: "none",
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "0px",
    boxShadow: "none",
    flexDirection: "column",
    gap: "16px",
  },
}))

const ProgramCardHeaderOuter = styled.div({
  display: "flex",
  padding: "16px 24px",
  alignItems: "center",
  alignSelf: "stretch",
  gap: "16px",
})

const ProgramCardHeaderInner = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "12px",
  flex: "1 0 0",
})

const StatusContainer = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
})

const DatePopoverContent = styled.div({
  maxWidth: "240px",
  display: "flex",
  padding: "8px",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "28px",
  alignSelf: "stretch",
})

const DatePopoverTrigger = styled(Link)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  "&:hover": {
    color: theme.custom.colors.silverGrayDark,
  },
}))

const DatePopoverHeading = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
}))

const DatePopoverBody = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.black,
}))

const ProgramCardSubHeaderText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const HorizontalSeparator = styled.div(({ theme }) => ({
  width: "1px",
  height: "13px",
  backgroundColor: theme.custom.colors.lightGray2,
}))

const ProgramCardSubHeader = styled.div(({ theme }) => ({
  display: "flex",
  padding: "8px 16px",
  alignItems: "center",
  alignSelf: "stretch",
  gap: "10px",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  background: `${theme.custom.colors.lightGray1}`,
  [theme.breakpoints.down("md")]: {
    borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRight: `1px solid ${theme.custom.colors.lightGray2}`,
  },
}))

const ProgramCardBody = styled.div({
  display: "flex",
  width: "100%",
  flexDirection: "column",
  alignItems: "stretch",
  alignSelf: "stretch",
  overflow: "hidden",
  borderRadius: "0 0 8px 8px",
})

const getTimezone = (dateString: string): string => {
  const tz =
    new Date(dateString)
      .toLocaleString("en-US", { timeZoneName: "short" })
      .split(" ")
      .pop() || ""
  return tz
}

const MS_IN_DAY = 1000 * 60 * 60 * 24

const formatDayCount = (days: number): string => {
  return `${days} day${days === 1 ? "" : "s"}`
}

interface RelativeDateContent {
  anchorLabel: string
  startVerb: "starts" | "started"
  startSuffix: string
  endVerb?: "ends" | "ended"
  endSuffix?: string
}

const getRelativeDateContent = (
  startDateString?: string | null,
  endDateString?: string | null,
  startDateDisplay?: string | null,
  endDateDisplay?: string | null,
): RelativeDateContent | null => {
  if (!startDateString) {
    return null
  }

  const now = Date.now()
  const startDate = new Date(startDateString)
  if (Number.isNaN(startDate.getTime())) {
    return null
  }

  const hasEndDate = Boolean(endDateString)
  const endDate = hasEndDate ? new Date(endDateString as string) : null
  const hasValidEndDate = Boolean(endDate) && !Number.isNaN(endDate!.getTime())

  if (!hasValidEndDate) {
    if (now < startDate.getTime()) {
      const daysUntilStart = Math.max(
        0,
        Math.ceil((startDate.getTime() - now) / MS_IN_DAY),
      )
      const dayCount = formatDayCount(daysUntilStart)
      return {
        anchorLabel: `${dayCount} until this course starts.`,
        startVerb: "starts",
        startSuffix: `in ${dayCount}${startDateDisplay ? ` on ${startDateDisplay}` : ""}.`,
      }
    }

    const daysSinceStart = Math.max(
      0,
      Math.floor((now - startDate.getTime()) / MS_IN_DAY),
    )
    const dayCount = formatDayCount(daysSinceStart)
    return {
      anchorLabel: `this course started ${dayCount} ago.`,
      startVerb: "started",
      startSuffix: `${dayCount} ago${startDateDisplay ? ` on ${startDateDisplay}` : ""}.`,
    }
  }

  const endTime = endDate!.getTime()

  if (now < startDate.getTime()) {
    const daysUntilStart = Math.max(
      0,
      Math.ceil((startDate.getTime() - now) / MS_IN_DAY),
    )
    const dayCount = formatDayCount(daysUntilStart)
    return {
      anchorLabel: `${dayCount} until this course starts.`,
      startVerb: "starts",
      startSuffix: `in ${dayCount}${startDateDisplay ? ` on ${startDateDisplay}` : ""}.`,
      endVerb: endDateDisplay ? "ends" : undefined,
      endSuffix: endDateDisplay ? `on ${endDateDisplay}.` : undefined,
    }
  }

  if (now <= endTime) {
    const daysUntilEnd = Math.max(0, Math.ceil((endTime - now) / MS_IN_DAY))
    const daysUntilStart = Math.max(
      0,
      Math.floor((now - startDate.getTime()) / MS_IN_DAY),
    )
    const endDayCount = formatDayCount(daysUntilEnd)
    const startDayCount = formatDayCount(daysUntilStart)
    return {
      anchorLabel: `${endDayCount} until this course ends.`,
      startVerb: "started",
      startSuffix: `${startDayCount} ago${startDateDisplay ? ` on ${startDateDisplay}` : ""}.`,
      endVerb: "ends",
      endSuffix: `in ${endDayCount}${endDateDisplay ? ` on ${endDateDisplay}` : ""}.`,
    }
  }

  const daysSinceEnd = Math.max(0, Math.floor((now - endTime) / MS_IN_DAY))
  const daysSinceStart = Math.max(
    0,
    Math.floor((now - startDate.getTime()) / MS_IN_DAY),
  )
  const endDayCount = formatDayCount(daysSinceEnd)
  const startDayCount = formatDayCount(daysSinceStart)
  return {
    anchorLabel: `this course ended ${endDayCount} ago.`,
    startVerb: "started",
    startSuffix: `${startDayCount} ago${startDateDisplay ? ` on ${startDateDisplay}` : ""}.`,
    endVerb: "ended",
    endSuffix: `${endDayCount} ago${endDateDisplay ? ` on ${endDateDisplay}` : ""}.`,
  }
}

interface ProgramAsCourseCardProps {
  /**
   * The courselike program to display.
   */
  courseProgram: {
    id: number
    readable_id: string
    title?: string | null
    start_date?: string | null
    end_date?: string | null
    courses?: number[]
    req_tree?: V2ProgramRequirement[]
  }
  /**
   * child courses of the program. These correspond to nodes in the req_tree.
   */
  moduleCourses: CourseWithCourseRunsSerializerV2[]
  /**
   * Enrollments in the child courses. These may or may not exist, depending on
   * whether the user has started that course.
   */
  moduleEnrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]>
  /**
   * Enrollment in the courselike program, if user has an enrollment in it.
   */
  courseProgramEnrollment?: V3UserProgramEnrollment
  /**
   * Additional ancestor program enrollments.
   *
   * This facilitates verified enrollments. For example:
   * - Ancestor Program P1
   *  - Courslike Program P1a
   *    - Child Course C1, etc...
   *
   * Initially, a user will have a verified enrollment in P1 but NOT P2.
   * We pass P1's enrollment as an ancestorProgramEnrollment. This allows us to
   * request a verified enrollment in both C1 and P1a.
   */
  ancestorProgramEnrollment?: {
    readable_id: string
    enrollment_mode?: string | null
  }
  Component?: React.ElementType
  className?: string
}

/**
 * Renders a v3 program in the dashboard's course presentation mode.
 *
 * When a program enrollment is configured with `display_mode="course"`, the
 * dashboard treats the program as a learner-facing "course" even though the
 * backing data still comes from the v3 program / program enrollment models.
 * In that presentation, the courses from the program's first requirement
 * section are shown as the course's "modules". It will only ever display
 * actual child courses of the program, never nested child programs.
 *
 * This component keeps the underlying program terminology in its data inputs,
 * but translates that data into the course-and-modules UI used on the
 * dashboard.
 */
const ProgramAsCourseCard: React.FC<ProgramAsCourseCardProps> = ({
  courseProgram,
  moduleCourses,
  moduleEnrollmentsByCourseId,
  courseProgramEnrollment,
  ancestorProgramEnrollment,
  Component,
  className,
}) => {
  const moduleRequirementSection = courseProgram?.req_tree?.find(
    (node) => node.data.node_type === "operator",
  )

  const moduleIds = moduleRequirementSection
    ? getIdsFromReqTree([moduleRequirementSection]).courseIds
    : (courseProgram?.courses ?? [])

  const moduleCoursesById = new Map(
    moduleCourses.map((course) => [course.id, course]),
  )
  const displayedModuleCourses = moduleIds
    .map((moduleId) => moduleCoursesById.get(moduleId))
    .filter((course): course is CourseWithCourseRunsSerializerV2 =>
      Boolean(course),
    )

  const enrolledCount = displayedModuleCourses.filter((course) => {
    const bestEnrollment = selectBestEnrollment(
      course,
      moduleEnrollmentsByCourseId[course.id] || [],
    )
    return getEnrollmentStatus(bestEnrollment) === EnrollmentStatus.Enrolled
  }).length

  const completedCount = displayedModuleCourses.filter((course) => {
    const bestEnrollment = selectBestEnrollment(
      course,
      moduleEnrollmentsByCourseId[course.id] || [],
    )
    return getEnrollmentStatus(bestEnrollment) === EnrollmentStatus.Completed
  }).length

  const totalCount = displayedModuleCourses.length

  const programEnrollmentStatus = getProgramEnrollmentStatus(
    courseProgramEnrollment,
    enrolledCount,
    completedCount,
  )

  const [popoverAnchorEl, setPopoverAnchorEl] =
    React.useState<HTMLAnchorElement | null>(null)

  const startDatePopoverString = courseProgram?.start_date
    ? `${formatDate(courseProgram.start_date, "MMMM D, YYYY h:mm A")} ${getTimezone(courseProgram.start_date)}`
    : null
  const endDatePopoverString = courseProgram?.end_date
    ? `${formatDate(courseProgram.end_date, "MMMM D, YYYY h:mm A")} ${getTimezone(courseProgram.end_date)}`
    : null
  const datePopoverContent = getRelativeDateContent(
    courseProgram?.start_date,
    courseProgram?.end_date,
    startDatePopoverString,
    endDatePopoverString,
  )
  const showDatePopoverTrigger = Boolean(datePopoverContent)

  const parentProgramIds = [
    courseProgram.readable_id,
    ...(ancestorProgramEnrollment
      ? [ancestorProgramEnrollment.readable_id]
      : []),
  ]
  const useVerifiedEnrollment =
    courseProgramEnrollment?.enrollment_mode === "verified" ||
    ancestorProgramEnrollment?.enrollment_mode === "verified"

  return (
    <ProgramCardRoot
      as={Component}
      className={className}
      data-testid="program-as-course-card"
    >
      <ProgramCardHeaderOuter>
        <ProgramCardHeaderInner>
          <StatusContainer>
            <ProgressBadge enrollmentStatus={programEnrollmentStatus} />
            {showDatePopoverTrigger && datePopoverContent && (
              <>
                <HorizontalSeparator />
                <Popover
                  anchorEl={popoverAnchorEl}
                  open={!!popoverAnchorEl}
                  onClose={() => setPopoverAnchorEl(null)}
                >
                  <DatePopoverContent>
                    <Stack direction="column" gap="4px">
                      <DatePopoverHeading variant="subtitle3">
                        Important Dates:
                      </DatePopoverHeading>
                      <DatePopoverBody variant="body3">
                        This course{" "}
                        <Typography variant="subtitle3" component="span">
                          {datePopoverContent.startVerb}
                        </Typography>{" "}
                        {datePopoverContent.startSuffix}
                      </DatePopoverBody>
                    </Stack>
                    {datePopoverContent.endVerb &&
                      datePopoverContent.endSuffix && (
                        <DatePopoverBody variant="body3">
                          This course{" "}
                          <Typography variant="subtitle3" component="span">
                            {datePopoverContent.endVerb}
                          </Typography>{" "}
                          {datePopoverContent.endSuffix}
                        </DatePopoverBody>
                      )}
                  </DatePopoverContent>
                </Popover>
                <DatePopoverTrigger
                  color="black"
                  onClick={(event) => setPopoverAnchorEl(event.currentTarget)}
                >
                  {datePopoverContent.anchorLabel}
                </DatePopoverTrigger>
              </>
            )}
          </StatusContainer>
          <Typography variant="subtitle2">{courseProgram?.title}</Typography>
        </ProgramCardHeaderInner>
      </ProgramCardHeaderOuter>
      <ProgramCardSubHeader>
        <ProgramCardSubHeaderText variant="subtitle3">
          {totalCount} Modules ({completedCount} of {totalCount} complete)
        </ProgramCardSubHeaderText>
      </ProgramCardSubHeader>
      <ProgramCardBody>
        {displayedModuleCourses.map((course) => {
          const bestEnrollment = selectBestEnrollment(
            course,
            moduleEnrollmentsByCourseId[course.id] || [],
          )
          const resource = bestEnrollment
            ? {
                type: ModuleCardType.CourseRunEnrollment,
                data: bestEnrollment,
              }
            : { type: ModuleCardType.Course, data: course }

          return (
            <ModuleCard
              key={getKey({
                resourceType: ResourceType.Course,
                id: course.id,
                runId: bestEnrollment?.run.id,
              })}
              resource={resource}
              useVerifiedEnrollment={useVerifiedEnrollment}
              parentProgramIds={parentProgramIds}
              variant="stacked"
            />
          )
        })}
      </ProgramCardBody>
    </ProgramCardRoot>
  )
}

export { ProgramAsCourseCard }
export type { ProgramAsCourseCardProps }
