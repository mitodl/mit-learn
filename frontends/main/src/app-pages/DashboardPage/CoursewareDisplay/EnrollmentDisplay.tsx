import React from "react"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import {
  Collapse,
  Link,
  PlainList,
  PlainListProps,
  Skeleton,
  Stack,
  Typography,
  TypographyProps,
  styled,
  theme,
} from "ol-components"
import { Alert } from "@mitodl/smoot-design"
import { useQuery } from "@tanstack/react-query"
import {
  EnrollmentStatus,
  getEnrollmentStatus,
  getKey,
  ResourceType,
  selectBestEnrollment,
} from "./helpers"
import { DashboardCard, DashboardType } from "./DashboardCard"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { programsQueries } from "api/mitxonline-hooks/programs"
import {
  CourseRunEnrollmentRequestV2,
  V2ProgramRequirement,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { contractQueries } from "api/mitxonline-hooks/contracts"
import NotFoundPage from "@/app-pages/ErrorPage/NotFoundPage"

const Wrapper = styled.div(({ theme }) => ({
  marginTop: "32px",
  padding: "24px 32px",
  backgroundColor: theme.custom.colors.white,
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  boxShadow: "0px 4px 8px 0px rgba(19, 20, 21, 0.08)",
  borderRadius: "8px",
  [theme.breakpoints.down("md")]: {
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    backgroundColor: "rgba(243, 244, 248, 0.60);", // TODO: use theme color
    marginTop: "16px",
    padding: "0",
  },
}))

const AlertBanner = styled(Alert)({
  marginBottom: "16px",
})

const DashboardCardStyled = styled(DashboardCard)({
  borderRadius: "8px",
  boxShadow: "0px 1px 6px 0px rgba(3, 21, 45, 0.05)",
})

const Title = styled(Typography)<Pick<TypographyProps, "component">>(
  ({ theme }) => ({
    ...theme.typography.h5,
    marginBottom: "16px",
    [theme.breakpoints.down("md")]: {
      padding: "16px",
      marginBottom: "0",
    },
  }),
)

const EnrollmentsList = styled(PlainList)<Pick<PlainListProps, "itemSpacing">>(
  ({ theme }) => ({
    [theme.breakpoints.down("md")]: {
      borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
      ">li+li": {
        marginTop: "0",
      },
    },
  }),
)

const StackedCardContainer = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  boxShadow: "0px 1px 6px 0px rgba(3, 21, 45, 0.05)",
  overflow: "hidden",
  [theme.breakpoints.down("md")]: {
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "8px !important",
    borderBottom: `1px solid ${theme.custom.colors.red}`,
  },
}))

const HiddenEnrollmentsList = styled(EnrollmentsList)({
  marginTop: "16px",
  [theme.breakpoints.down("md")]: {
    borderTop: "none",
    marginTop: "0",
  },
})

const ShowAllContainer = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  marginTop: "24px",
  [theme.breakpoints.down("md")]: {
    marginBottom: "24px",
  },
}))

const alphabeticalSort = (
  a: CourseRunEnrollmentRequestV2,
  b: CourseRunEnrollmentRequestV2,
) => a.run.course.title.localeCompare(b.run.course.title)

const startsSooner = (
  a: CourseRunEnrollmentRequestV2,
  b: CourseRunEnrollmentRequestV2,
) => {
  if (!a.run.start_date && !b.run.start_date) return 0
  if (!a.run.start_date) return 1
  if (!b.run.start_date) return -1
  const x = new Date(a.run.start_date)
  const y = new Date(b.run.start_date)
  return x.getTime() - y.getTime()
}
const sortEnrollments = (enrollments: CourseRunEnrollmentRequestV2[]) => {
  const expired: CourseRunEnrollmentRequestV2[] = []
  const completed: CourseRunEnrollmentRequestV2[] = []
  const started: CourseRunEnrollmentRequestV2[] = []
  const notStarted: CourseRunEnrollmentRequestV2[] = []
  enrollments.forEach((enrollment) => {
    if (!enrollment?.b2b_contract_id) {
      const enrollmentStatus = getEnrollmentStatus(enrollment)
      if (enrollmentStatus === EnrollmentStatus.Completed) {
        completed.push(enrollment)
      } else if (
        enrollment.run.end_date &&
        new Date(enrollment.run.end_date) < new Date()
      ) {
        expired.push(enrollment)
      } else if (
        enrollment.run.start_date &&
        new Date(enrollment.run.start_date) < new Date()
      ) {
        started.push(enrollment)
      } else {
        notStarted.push(enrollment)
      }
    }
  })

  return {
    completed: completed.sort(alphabeticalSort),
    expired: expired.sort(alphabeticalSort),
    started: started.sort(alphabeticalSort),
    notStarted: notStarted.sort(startsSooner),
  }
}

interface EnrollmentExpandCollapseProps {
  shownCourseRunEnrollments: CourseRunEnrollmentRequestV2[]
  hiddenCourseRunEnrollments: CourseRunEnrollmentRequestV2[]
  programEnrollments?: V3UserProgramEnrollment[]
  isLoading?: boolean
  onUpgradeError?: (error: string) => void
}

const EnrollmentExpandCollapse: React.FC<EnrollmentExpandCollapseProps> = ({
  shownCourseRunEnrollments,
  hiddenCourseRunEnrollments,
  programEnrollments,
  isLoading,
  onUpgradeError,
}) => {
  const [shown, setShown] = React.useState(false)

  const handleToggle = (event: React.MouseEvent) => {
    event.preventDefault()
    setShown(!shown)
  }

  return (
    <>
      <EnrollmentsList itemSpacing={"16px"}>
        {shownCourseRunEnrollments.map((enrollment) => {
          return (
            <DashboardCardStyled
              key={getKey({
                resourceType: ResourceType.Course,
                id: enrollment.run.course.id,
                runId: enrollment.run.id,
              })}
              Component="li"
              resource={{
                type: DashboardType.CourseRunEnrollment,
                data: enrollment,
              }}
              showNotComplete={false}
              isLoading={isLoading}
              onUpgradeError={onUpgradeError}
            />
          )
        })}
        {programEnrollments?.map((program) => (
          <DashboardCardStyled
            key={getKey({
              resourceType: ResourceType.Program,
              id: program.program.id,
            })}
            Component="li"
            resource={{
              type: DashboardType.ProgramEnrollment,
              data: program,
            }}
            showNotComplete={false}
            isLoading={isLoading}
            onUpgradeError={onUpgradeError}
          />
        ))}
      </EnrollmentsList>
      {hiddenCourseRunEnrollments.length === 0 ? null : (
        <>
          <Collapse orientation="vertical" in={shown}>
            <HiddenEnrollmentsList itemSpacing={"16px"}>
              {hiddenCourseRunEnrollments.map((enrollment) => (
                <DashboardCardStyled
                  key={getKey({
                    resourceType: ResourceType.Course,
                    id: enrollment.run.course.id,
                    runId: enrollment.run.id,
                  })}
                  Component="li"
                  resource={{
                    type: DashboardType.CourseRunEnrollment,
                    data: enrollment,
                  }}
                  showNotComplete={false}
                  isLoading={isLoading}
                  onUpgradeError={onUpgradeError}
                />
              ))}
            </HiddenEnrollmentsList>
          </Collapse>
          <ShowAllContainer>
            <Link color="red" size="medium" onClick={handleToggle}>
              {shown ? "Show less" : "Show all"}
            </Link>
          </ShowAllContainer>
        </>
      )}
    </>
  )
}

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

const getRequirementSectionTitle = (node: V2ProgramRequirement): string => {
  if (node.data.title) {
    return node.data.title
  }
  if (node.data.elective_flag) {
    if (node.data.operator === "min_number_of" && node.data.operator_value) {
      return `Electives (Complete ${node.data.operator_value})`
    }
    return "Elective Courses"
  }
  return "Core Courses"
}

interface ProgramEnrollmentDisplayProps {
  programId: number
}

const ProgramEnrollmentDisplay: React.FC<ProgramEnrollmentDisplayProps> = ({
  programId,
}) => {
  const { data: rawEnrollments, isLoading: userEnrollmentsLoading } = useQuery(
    enrollmentQueries.courseRunEnrollmentsList(),
  )
  const { data: program, isLoading: programLoading } = useQuery(
    programsQueries.programDetail({ id: programId.toString() }),
  )

  const { data: programEnrollments, isLoading: programEnrollmentsLoading } =
    useQuery(enrollmentQueries.programEnrollmentsList())
  const enrolledInProgram = programEnrollments?.some((enrollment) => {
    return enrollment.program.id === program?.id
  })

  const programEnrollment = programEnrollments?.find(
    (enrollment) => enrollment.program.id === program?.id,
  )

  // Only fetch courses if we have a program with course IDs
  const { data: programCourses, isLoading: programCoursesLoading } = useQuery({
    ...coursesQueries.coursesList({ id: program?.courses || [] }),
    enabled: !!program && program.courses.length > 0 && enrolledInProgram,
  })

  const isLoading =
    userEnrollmentsLoading ||
    programLoading ||
    programEnrollmentsLoading ||
    programCoursesLoading

  // Group enrollments by course ID for efficient lookup
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

  // Build sections from requirement tree
  const requirementSections =
    program?.req_tree
      .filter((node) => node.data.node_type === "operator")
      .map((node) => {
        const courseIds = extractCoursesFromNode(node)
        const sectionCourses = (programCourses?.results || []).filter(
          (course) => courseIds.includes(course.id),
        )

        return {
          key: node.id,
          title: getRequirementSectionTitle(node),
          courses: sectionCourses,
          node,
        }
      })
      .filter((section) => section.courses.length > 0) || []

  const allProgramCourses = requirementSections.flatMap(
    (section) => section.courses,
  )
  const completedCount = allProgramCourses.filter((course) => {
    const bestEnrollment = selectBestEnrollment(
      course,
      enrollmentsByCourseId[course.id] || [],
    )
    return getEnrollmentStatus(bestEnrollment) === EnrollmentStatus.Completed
  }).length

  // Calculate total required courses, respecting operator_value if operator is specified
  const totalCount = requirementSections.reduce((sum, section) => {
    if (
      section.node.data.operator === "min_number_of" &&
      section.node.data.operator_value
    ) {
      return sum + parseInt(section.node.data.operator_value, 10)
    }
    return sum + section.courses.length
  }, 0)

  if (isLoading) {
    return (
      <Stack direction="column">
        <Stack direction="column" marginBottom="56px">
          <Skeleton variant="text" width="30%" height={24} />
          <Skeleton variant="text" width="50%" height={32} />
        </Stack>
        <Skeleton variant="rectangular" width="50%" height={24} />
        <Stack direction="column" spacing={2} paddingTop="16px">
          <Skeleton variant="rectangular" width="100%" height={64} />
          <Skeleton variant="rectangular" width="100%" height={64} />
          <Skeleton variant="rectangular" width="100%" height={64} />
        </Stack>
      </Stack>
    )
  }
  if (!enrolledInProgram) {
    return <NotFoundPage />
  }
  return (
    <Stack direction="column">
      <Stack direction="column" marginBottom="24px">
        <Typography variant="h5" color={theme.custom.colors.silverGrayDark}>
          MITx | {program?.program_type}
        </Typography>
        <Typography component="h1" variant="h3" paddingBottom="32px">
          {program?.title}
        </Typography>
        <Typography variant="body2">
          You have completed
          <Typography component="span" variant="subtitle2">
            {" "}
            {completedCount} of {totalCount} courses{" "}
          </Typography>
          for this program.
        </Typography>
      </Stack>
      {requirementSections.map((section, index) => {
        const sectionCompletedCount = section.courses.filter((course) => {
          const bestEnrollment = selectBestEnrollment(
            course,
            enrollmentsByCourseId[course.id] || [],
          )
          return (
            getEnrollmentStatus(bestEnrollment) === EnrollmentStatus.Completed
          )
        }).length

        const sectionRequiredCount =
          section.node.data.operator === "min_number_of" &&
          section.node.data.operator_value
            ? parseInt(section.node.data.operator_value, 10)
            : section.courses.length

        return (
          <React.Fragment key={section.key}>
            <Stack
              direction="row"
              justifyContent="space-between"
              marginBottom="16px"
              marginTop={index > 0 ? "32px" : "0"}
            >
              <Typography
                component="h1"
                variant="subtitle2"
                color={theme.custom.colors.red}
              >
                {section.title}
              </Typography>
              <Typography
                variant="body2"
                color={theme.custom.colors.silverGrayDark}
              >
                Completed {sectionCompletedCount} of {sectionRequiredCount}
              </Typography>
            </Stack>
            <StackedCardContainer>
              {section.courses.map((course) => {
                // Check if user has an enrollment for this course
                const bestEnrollment = selectBestEnrollment(
                  course,
                  enrollmentsByCourseId[course.id] || [],
                )

                // If enrolled, show enrollment card with status, otherwise show course card
                const resource = bestEnrollment
                  ? {
                      type: DashboardType.CourseRunEnrollment,
                      data: bestEnrollment,
                    }
                  : { type: DashboardType.Course, data: course }

                return (
                  <DashboardCardStyled
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
            </StackedCardContainer>
          </React.Fragment>
        )
      })}
    </Stack>
  )
}

const MIN_VISIBLE = 3

/**
 * Renders the "My Learning" section for non-B2B enrollments.
 *
 * Cards are ordered and grouped as follows:
 *  1. Started courses (past start date, not expired, not completed)
 *  2. Not-yet-started courses
 *  3. Completed courses (any passing grade)
 *  4. Program enrollments (excluding those covered by a B2B contract)
 *  5. Expired courses (past end date, not completed) — hidden behind "Show all"
 *
 * Exception: if groups 1–4 are all empty, up to MIN_VISIBLE expired courses
 * are shown directly so the section is never blank for an enrolled user.
 * The section is hidden entirely only when there are no enrollments at all.
 */
const AllEnrollmentsDisplay: React.FC = () => {
  const [upgradeError, setUpgradeError] = React.useState<string | null>(null)
  const { data: enrolledCourses, isLoading: courseEnrollmentsLoading } =
    useQuery({
      ...enrollmentQueries.courseRunEnrollmentsList(),
    })
  const { data: contracts, isLoading: contractsLoading } = useQuery(
    contractQueries.contractsList(),
  )
  const { data: programEnrollments, isLoading: programEnrollmentsLoading } =
    useQuery(enrollmentQueries.programEnrollmentsList())
  const filteredProgramEnrollments =
    programEnrollments?.filter((enrollment) => {
      return !contracts?.some((contract) =>
        contract.programs.includes(enrollment.program.id),
      )
    }) ?? []

  const supportEmail = process.env.NEXT_PUBLIC_MITOL_SUPPORT_EMAIL || ""

  const { completed, expired, started, notStarted } = sortEnrollments(
    enrolledCourses || [],
  )

  const normallyShown = [...started, ...notStarted, ...completed]
  const hasNormallyShown =
    normallyShown.length > 0 || filteredProgramEnrollments.length > 0
  const expiredVisible = hasNormallyShown
    ? 0
    : Math.min(expired.length, MIN_VISIBLE)
  const shownCourseRunEnrollments = [
    ...normallyShown,
    ...expired.slice(0, expiredVisible),
  ]
  const hiddenExpired = expired.slice(expiredVisible)
  const totalCards =
    normallyShown.length + filteredProgramEnrollments.length + expired.length

  return totalCards > 0 ? (
    <Wrapper>
      <Title variant="h5" component="h2">
        My Learning
      </Title>
      {upgradeError && (
        <AlertBanner
          severity="error"
          closable={true}
          onClose={() => setUpgradeError(null)}
        >
          {upgradeError}{" "}
          <Link color="red" href={`mailto:${supportEmail}`}>
            Contact Support
          </Link>{" "}
          for assistance.
        </AlertBanner>
      )}
      <EnrollmentExpandCollapse
        shownCourseRunEnrollments={shownCourseRunEnrollments}
        hiddenCourseRunEnrollments={hiddenExpired}
        programEnrollments={filteredProgramEnrollments}
        isLoading={
          courseEnrollmentsLoading ||
          programEnrollmentsLoading ||
          contractsLoading
        }
        onUpgradeError={setUpgradeError}
      />
    </Wrapper>
  ) : null
}

interface EnrollmentDisplayProps {
  programId?: number
}

const EnrollmentDisplay: React.FC<EnrollmentDisplayProps> = ({ programId }) => {
  if (programId) {
    return <ProgramEnrollmentDisplay programId={programId} />
  }

  return <AllEnrollmentsDisplay />
}

export { EnrollmentDisplay }
