import React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Popover,
  SimpleMenu,
  Skeleton,
  Stack,
  Typography,
  styled,
  theme,
} from "ol-components"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { V2ProgramRequirement } from "@mitodl/mitxonline-api-axios/v2"
import {
  EnrollmentStatus,
  getCourseRunEnrollmentStatus,
  getKey,
  getProgramEnrollmentStatus,
  ResourceType,
  selectBestEnrollment,
} from "./helpers"
import {
  DashboardCard,
  DashboardCardMenuButton,
  DashboardType,
  getContextMenuItems,
} from "./DashboardCard"
import { ProgressBadge } from "./ProgressBadge"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { RiMore2Line } from "@remixicon/react"
import { LinkButton } from "@/page-components/TiptapEditor/vendor/components/tiptap-ui/link-popover"
import { formatDate } from "ol-utilities"

const ProgramCardRoot = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  alignSelf: "stretch",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderBottom: "none",
  backgroundColor: theme.custom.colors.white,
  boxShadow: "0 1px 3px 0 rgba(120, 147, 172, 0.20)",
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

const HorizontalSeparator = styled.div({
  width: "1px",
  height: "13px",
  backgroundColor: theme.custom.colors.lightGray2,
})

const ProgramCardSubHeader = styled.div({
  display: "flex",
  padding: "8px 16px",
  alignItems: "center",
  alignSelf: "stretch",
  gap: "10px",
  borderTop: "1px solid var(--Gray-200---Light-Gray-2, #DDE1E6)",
  background: "var(--Gray-100---Light-Gray-1, #F3F4F8)",
})

const ProgramCardBody = styled.div({
  display: "flex",
  width: "100%",
  flexDirection: "column",
  alignItems: "stretch",
  alignSelf: "stretch",
  overflow: "hidden",
  borderRadius: "0 0 8px 8px",
  [theme.breakpoints.down("md")]: {
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "8px !important",
    borderBottom: `1px solid ${theme.custom.colors.red}`,
  },
})

const extractCoursesFromNode = (node: V2ProgramRequirement): number[] => {
  const courses: number[] = []

  if (node.data.node_type === "course" && node.data.course) {
    courses.push(node.data.course)
  }

  if (node.children) {
    node.children.forEach((child) => {
      courses.push(...extractCoursesFromNode(child))
    })
  }

  return courses
}

const getTimezone = (dateString: string): string => {
  const tz =
    new Date(dateString)
      .toLocaleString("en-US", { timeZoneName: "short" })
      .split(" ")
      .pop() || ""
  return tz
}

interface ProgramAsCourseCardProps {
  programId: number
  Component?: React.ElementType
  className?: string
}

export const ProgramAsCourseCard: React.FC<ProgramAsCourseCardProps> = ({
  programId,
  Component,
  className,
}) => {
  const useProductPages = useFeatureFlagEnabled(
    FeatureFlags.MitxOnlineProductPages,
  )

  const { data: rawEnrollments, isLoading: userEnrollmentsLoading } = useQuery(
    enrollmentQueries.courseRunEnrollmentsList(),
  )
  const { data: program, isLoading: programLoading } = useQuery(
    programsQueries.programDetail({ id: programId.toString() }),
  )

  const { data: programEnrollments, isLoading: programEnrollmentsLoading } =
    useQuery(enrollmentQueries.programEnrollmentsList())

  const enrolledInProgram = programEnrollments?.some(
    (enrollment) => enrollment.program.id === program?.id,
  )

  const programEnrollment = programEnrollments?.find(
    (enrollment) => enrollment.program.id === program?.id,
  )

  const { data: programCourses, isLoading: programCoursesLoading } = useQuery({
    ...coursesQueries.coursesList({ id: program?.courses || [] }),
    enabled: !!program && program.courses.length > 0 && enrolledInProgram,
  })

  const isLoading =
    userEnrollmentsLoading ||
    programLoading ||
    programEnrollmentsLoading ||
    programCoursesLoading

  const enrollmentsByCourseId = (rawEnrollments || []).reduce(
    (acc, enrollment) => {
      const courseId = enrollment.run.course.id
      if (!acc[courseId]) {
        acc[courseId] = []
      }
      acc[courseId].push(enrollment)
      return acc
    },
    {} as Record<number, typeof rawEnrollments>,
  )

  const firstRequirementSection = program?.req_tree.find(
    (node) => node.data.node_type === "operator",
  )

  const moduleIds = firstRequirementSection
    ? extractCoursesFromNode(firstRequirementSection)
    : []

  const modules = (programCourses?.results || []).filter((course) =>
    moduleIds.includes(course.id),
  )

  const enrolledCount = modules.filter((course) => {
    const bestEnrollment = selectBestEnrollment(
      course,
      enrollmentsByCourseId[course.id] || [],
    )
    return (
      getCourseRunEnrollmentStatus(bestEnrollment) === EnrollmentStatus.Enrolled
    )
  }).length

  const completedCount = modules.filter((course) => {
    const bestEnrollment = selectBestEnrollment(
      course,
      enrollmentsByCourseId[course.id] || [],
    )
    return (
      getCourseRunEnrollmentStatus(bestEnrollment) ===
      EnrollmentStatus.Completed
    )
  }).length

  const totalCount = modules.length

  const programEnrollmentStatus = getProgramEnrollmentStatus(
    programEnrollment,
    enrolledCount,
  )

  const menuItems = programEnrollment
    ? getContextMenuItems(
        programEnrollment.program.title || "Program",
        { type: "program-enrollment", data: programEnrollment },
        useProductPages ?? false,
        [],
        true,
      )
    : []

  const contextMenu = isLoading ? (
    <Skeleton variant="rectangular" width={12} height={24} />
  ) : (
    <SimpleMenu
      items={menuItems}
      trigger={
        <DashboardCardMenuButton
          size="small"
          variant="text"
          aria-label="More options"
          status={programEnrollmentStatus}
          hidden={menuItems.length === 0}
        >
          <RiMore2Line />
        </DashboardCardMenuButton>
      }
    />
  )

  const [popoverAnchorEl, setPopoverAnchorEl] =
    React.useState<HTMLButtonElement | null>(null)

  const startDatePopoverString = program?.start_date
    ? `${formatDate(program.start_date, "MMMM D, YYYY h:mm A")} ${getTimezone(program.start_date)}`
    : null
  const endDatePopoverString = program?.end_date
    ? `${formatDate(program.end_date, "MMMM D, YYYY h:mm A")} ${getTimezone(program.end_date)}`
    : null
  const linkButtonEndDate = program?.end_date
    ? formatDate(program.end_date, "MMMM Do YYYY")
    : null
  const daysTillEnd = program?.end_date
    ? Math.ceil(
        (new Date(program.end_date).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null

  if (isLoading) {
    return (
      <ProgramCardRoot as={Component} className={className}>
        <ProgramCardHeaderOuter>
          <Skeleton variant="text" width="50%" height={20} />
          <Skeleton variant="text" width="70%" height={28} />
        </ProgramCardHeaderOuter>
        <ProgramCardBody>
          <Skeleton variant="text" width="40%" height={24} />
          <Stack direction="column" spacing={2} paddingTop="16px">
            <Skeleton variant="rectangular" width="100%" height={64} />
            <Skeleton variant="rectangular" width="100%" height={64} />
          </Stack>
        </ProgramCardBody>
      </ProgramCardRoot>
    )
  }

  return (
    <ProgramCardRoot as={Component} className={className}>
      <ProgramCardHeaderOuter>
        <ProgramCardHeaderInner>
          <StatusContainer>
            <ProgressBadge enrollmentStatus={programEnrollmentStatus} />
            {startDatePopoverString && endDatePopoverString && daysTillEnd && (
              <>
                <HorizontalSeparator />
                <Popover
                  anchorEl={popoverAnchorEl}
                  open={!!popoverAnchorEl}
                  onClose={() => setPopoverAnchorEl(null)}
                >
                  <DatePopoverContent>
                    <Stack direction="column" gap="4px">
                      <Typography
                        variant="subtitle3"
                        color={theme.custom.colors.black}
                      >
                        Important Dates:
                      </Typography>
                      <Typography
                        variant="body3"
                        color={theme.custom.colors.black}
                      >
                        This course{" "}
                        <Typography variant="subtitle3" component="span">
                          started
                        </Typography>{" "}
                        on {startDatePopoverString}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body3"
                      color={theme.custom.colors.black}
                    >
                      This course will{" "}
                      <Typography variant="subtitle3" component="span">
                        end
                      </Typography>{" "}
                      in {daysTillEnd} days on {endDatePopoverString}
                    </Typography>
                  </DatePopoverContent>
                </Popover>
                <LinkButton
                  onClick={(event) => setPopoverAnchorEl(event.currentTarget)}
                  title=""
                  tooltip=""
                  aria-label=""
                >
                  <Typography
                    variant="body2"
                    color={theme.custom.colors.silverGrayDark}
                  >
                    Ends {linkButtonEndDate}
                  </Typography>
                </LinkButton>
              </>
            )}
          </StatusContainer>
          <Typography variant="subtitle2">{program?.title}</Typography>
        </ProgramCardHeaderInner>
        {contextMenu}
      </ProgramCardHeaderOuter>
      <ProgramCardSubHeader>
        <Typography
          variant="subtitle3"
          color={theme.custom.colors.silverGrayDark}
        >
          {totalCount} Modules ({completedCount} of {totalCount} complete)
        </Typography>
      </ProgramCardSubHeader>
      <ProgramCardBody>
        {modules.map((course) => {
          const bestEnrollment = selectBestEnrollment(
            course,
            enrollmentsByCourseId[course.id] || [],
          )

          const resource = bestEnrollment
            ? {
                type: DashboardType.CourseRunEnrollment,
                data: bestEnrollment,
              }
            : { type: DashboardType.Course, data: course }

          return (
            <DashboardCard
              key={getKey({
                resourceType: ResourceType.Course,
                id: course.id,
                runId: bestEnrollment?.run.id,
              })}
              resource={resource}
              programEnrollment={programEnrollment}
              showNotComplete={false}
              variant="stacked"
            />
          )
        })}
      </ProgramCardBody>
    </ProgramCardRoot>
  )
}
