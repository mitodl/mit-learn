import React from "react"
import {
  SimpleMenu,
  SimpleMenuItem,
  Stack,
  Typography,
  styled,
} from "ol-components"
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
import { CoursewareCard } from "./CoursewareCard"
import {
  CardTypeText,
  CourseDateSummary,
  Separator,
  UpgradedBanner,
} from "./CardShared"
import {
  getCertificateLink,
  buildCourseEntry,
} from "./model/dashboardViewModel"
import {
  getIdsFromReqTree,
  isVerifiedEnrollmentMode,
  mitxonlineLegacyUrl,
} from "@/common/mitxonline"
import { ActionButton } from "@mitodl/smoot-design"
import { RiAwardFill, RiMore2Line } from "@remixicon/react"
import NiceModal from "@ebay/nice-modal-react"
import { UnenrollProgramDialog } from "./DashboardDialogs"
import { ProgramCertificateButton } from "./ProgramEnrollmentDisplay"
import { programPageView } from "@/common/urls"

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

const ProgramCardSubHeaderText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
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

const MenuButton = styled(ActionButton)<{
  status: EnrollmentStatus
}>(({ theme, status }) => [
  {
    marginLeft: "-8px",
    [theme.breakpoints.down("md")]: {
      position: "absolute",
      top: "0",
      right: "0",
    },
  },
  status !== EnrollmentStatus.Completed &&
    status !== EnrollmentStatus.Enrolled && {
      visibility: "hidden",
    },
])

const getContextMenuItems = (
  title: string,
  resource: ProgramAsCourse,
  enrollmentMode: string | null | undefined,
  additionalItems: SimpleMenuItem[] = [],
) => {
  const menuItems = []
  const detailsUrl = programPageView({
    readable_id: resource.readable_id,
    display_mode: "course",
  })

  const courseMenuItems = []

  if (detailsUrl) {
    courseMenuItems.push({
      className: "dashboard-card-menu-item",
      key: "view-course-details",
      label: "View Course Details",
      href: detailsUrl,
    })
  }

  courseMenuItems.push({
    className: "dashboard-card-menu-item",
    key: "program-record",
    label: "Program Record",
    href: mitxonlineLegacyUrl(`/records/${resource.id}/`),
  })

  if (enrollmentMode && !isVerifiedEnrollmentMode(enrollmentMode)) {
    courseMenuItems.push({
      className: "dashboard-card-menu-item",
      key: "unenroll",
      label: "Unenroll",
      onClick: () => {
        NiceModal.show(UnenrollProgramDialog, {
          title,
          enrollment: resource.readable_id,
        })
      },
    })
  }

  menuItems.push(...courseMenuItems)
  return [...menuItems, ...additionalItems]
}

interface ProgramAsCourse {
  id: number
  readable_id: string
  title?: string | null
  start_date?: string | null
  end_date?: string | null
  courses?: number[]
  req_tree?: V2ProgramRequirement[]
}

interface ProgramAsCourseCardProps {
  /**
   * The courselike program to display.
   */
  courseProgram: ProgramAsCourse
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
   *  - Courselike Program P1a
   *    - Child Course C1, etc...
   *
   * Initially, a user will have a verified enrollment in P1 but NOT P1a.
   * We pass P1's enrollment as an ancestorProgramEnrollment. This allows us to
   * request a verified enrollment in both C1 and P1a.
   */
  ancestorProgramEnrollment?: {
    readable_id: string
    enrollment_mode?: string | null
  }
  Component?: React.ElementType
  contextMenuItems?: SimpleMenuItem[]
  className?: string
  onUpgradeError?: (error: string) => void
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
  contextMenuItems = [],
  className,
  onUpgradeError,
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

  const parentProgramIds = [
    courseProgram.readable_id,
    ...(ancestorProgramEnrollment
      ? [ancestorProgramEnrollment.readable_id]
      : []),
  ]
  const useVerifiedEnrollment = [
    courseProgramEnrollment?.enrollment_mode,
    ancestorProgramEnrollment?.enrollment_mode,
  ].some(isVerifiedEnrollmentMode)

  const programCertificateUrl = getCertificateLink(
    courseProgramEnrollment?.certificate?.link,
    "program",
  )
  const upgradedAndIncomplete = useVerifiedEnrollment && !programCertificateUrl

  // Build context menu
  const menuItems = getContextMenuItems(
    courseProgram.title ?? "",
    courseProgram,
    courseProgramEnrollment?.enrollment_mode,
    contextMenuItems,
  )

  const contextMenu = (
    <SimpleMenu
      items={menuItems}
      trigger={
        <MenuButton
          size="small"
          variant="text"
          aria-label="More options"
          status={programEnrollmentStatus}
          hidden={menuItems.length === 0}
        >
          <RiMore2Line />
        </MenuButton>
      }
    />
  )

  const progressBadgeSection = (
    <Stack direction="row" gap="4px" alignItems="center">
      <ProgressBadge enrollmentStatus={programEnrollmentStatus} />
      <Separator />
      <CardTypeText>Course</CardTypeText>
    </Stack>
  )

  return (
    <ProgramCardRoot
      as={Component}
      className={className}
      data-testid="program-as-course-card"
    >
      <ProgramCardHeaderOuter>
        <ProgramCardHeaderInner>
          <StatusContainer>
            {progressBadgeSection}
            <CourseDateSummary
              startDate={courseProgram?.start_date}
              endDate={courseProgram?.end_date}
            />
          </StatusContainer>
          <Typography variant="subtitle2" component="h3">
            {courseProgram?.title}
          </Typography>
        </ProgramCardHeaderInner>
        <Stack direction="row" gap="0">
          {programCertificateUrl ? (
            <ProgramCertificateButton
              variant="bordered"
              size="small"
              startIcon={<RiAwardFill />}
              href={programCertificateUrl}
            >
              Certificate
            </ProgramCertificateButton>
          ) : upgradedAndIncomplete ? (
            <UpgradedBanner />
          ) : null}
          {contextMenu}
        </Stack>
      </ProgramCardHeaderOuter>
      <ProgramCardSubHeader>
        <ProgramCardSubHeaderText variant="subtitle3">
          {totalCount} Modules ({completedCount} of {totalCount} complete)
        </ProgramCardSubHeaderText>
      </ProgramCardSubHeader>
      <ProgramCardBody>
        {displayedModuleCourses.map((course) => {
          const entry = buildCourseEntry(
            course,
            moduleEnrollmentsByCourseId[course.id] || [],
            {
              ancestorContext: {
                useVerifiedEnrollment,
                parentProgramReadableIds: parentProgramIds,
              },
            },
          )
          if (!entry) return null

          return (
            <CoursewareCard
              key={getKey({
                resourceType: ResourceType.Course,
                id: course.id,
                runId: entry.displayedEnrollment?.run.id,
              })}
              kind="course"
              entry={entry}
              layout="compact"
              headingLevel="h4"
              isModule
              onUpgradeError={onUpgradeError}
            />
          )
        })}
      </ProgramCardBody>
    </ProgramCardRoot>
  )
}

export { ProgramAsCourseCard }
export type { ProgramAsCourseCardProps }
