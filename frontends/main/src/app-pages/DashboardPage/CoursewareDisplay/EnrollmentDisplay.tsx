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
import { useQuery } from "@tanstack/react-query"
import {
  mitxonlineCourse,
  mitxonlineProgram,
  programEnrollmentsToPrograms,
  userEnrollmentsToDashboardCourses,
} from "./transform"
import { DashboardCard } from "./DashboardCard"
import { DashboardCourse, DashboardProgram, EnrollmentStatus } from "./types"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { V2ProgramRequirement } from "@mitodl/mitxonline-api-axios/v2"
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

const alphabeticalSort = (a: DashboardCourse, b: DashboardCourse) =>
  a.title.localeCompare(b.title)

const startsSooner = (a: DashboardCourse, b: DashboardCourse) => {
  if (!a.run.startDate && !b.run.startDate) return 0
  if (!a.run.startDate) return 1
  if (!b.run.startDate) return -1
  const x = new Date(a.run.startDate)
  const y = new Date(b.run.startDate)
  return x.getTime() - y.getTime()
}
const sortEnrollments = (resources: DashboardCourse[]) => {
  const expired: DashboardCourse[] = []
  const completed: DashboardCourse[] = []
  const started: DashboardCourse[] = []
  const notStarted: DashboardCourse[] = []
  resources.forEach((resource) => {
    if (!resource.enrollment?.b2b_contract_id) {
      if (resource.enrollment?.status === EnrollmentStatus.Completed) {
        completed.push(resource)
      } else if (
        resource.run.endDate &&
        new Date(resource.run.endDate) < new Date()
      ) {
        expired.push(resource)
      } else if (
        resource.run.startDate &&
        new Date(resource.run.startDate) < new Date()
      ) {
        started.push(resource)
      } else {
        notStarted.push(resource)
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
  shownCourseRunEnrollments: DashboardCourse[]
  hiddenCourseRunEnrollments: DashboardCourse[]
  programEnrollments?: DashboardProgram[]
  isLoading?: boolean
}

const EnrollmentExpandCollapse: React.FC<EnrollmentExpandCollapseProps> = ({
  shownCourseRunEnrollments,
  hiddenCourseRunEnrollments,
  programEnrollments,
  isLoading,
}) => {
  const [shown, setShown] = React.useState(false)

  const handleToggle = (event: React.MouseEvent) => {
    event.preventDefault()
    setShown(!shown)
  }

  return (
    <>
      <EnrollmentsList itemSpacing={"16px"}>
        {shownCourseRunEnrollments.map((course) => (
          <DashboardCardStyled
            titleAction="marketing"
            key={course.key}
            Component="li"
            dashboardResource={course}
            showNotComplete={false}
            isLoading={isLoading}
          />
        ))}
        {programEnrollments?.map((program) => (
          <DashboardCardStyled
            titleAction="marketing"
            key={program.key}
            Component="li"
            dashboardResource={program}
            showNotComplete={false}
            isLoading={isLoading}
          />
        ))}
      </EnrollmentsList>
      {hiddenCourseRunEnrollments.length === 0 ? null : (
        <>
          <Collapse orientation="vertical" in={shown}>
            <HiddenEnrollmentsList itemSpacing={"16px"}>
              {hiddenCourseRunEnrollments.map((course) => (
                <DashboardCardStyled
                  titleAction="marketing"
                  key={course.key}
                  Component="li"
                  dashboardResource={course}
                  showNotComplete={false}
                  isLoading={isLoading}
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
  const { data: userCourses, isLoading: userEnrollmentsLoading } = useQuery({
    ...enrollmentQueries.courseRunEnrollmentsList(),
    select: userEnrollmentsToDashboardCourses,
  })
  const { data: rawProgram, isLoading: programLoading } = useQuery(
    programsQueries.programDetail({ id: programId }),
  )
  const program = rawProgram ? mitxonlineProgram(rawProgram) : undefined

  const { data: programEnrollments, isLoading: programEnrollmentsLoading } =
    useQuery(enrollmentQueries.programEnrollmentsList())
  const enrolledInProgram = programEnrollments?.some((enrollment) => {
    return enrollment.program.id === program?.id
  })

  // Only fetch courses if we have a program with course IDs
  const { data: rawProgramCourses, isLoading: programCoursesLoading } =
    useQuery({
      ...coursesQueries.coursesList({ id: program?.courseIds || [] }),
      enabled: !!program && program.courseIds.length > 0 && enrolledInProgram,
    })

  const isLoading =
    userEnrollmentsLoading ||
    programLoading ||
    programEnrollmentsLoading ||
    programCoursesLoading

  // Build sections from requirement tree
  const requirementSections =
    program?.reqTree
      .filter((node) => node.data.node_type === "operator")
      .map((node) => {
        const courseIds = extractCoursesFromNode(node)
        const sectionCourses = (rawProgramCourses?.results || [])
          .filter((course) => courseIds.includes(course.id))
          .map((course) => {
            const enrollment = userCourses?.find((dashboardCourse) =>
              course.courseruns.some(
                (run) => run.courseware_id === dashboardCourse.coursewareId,
              ),
            )?.enrollment
            return mitxonlineCourse(course, enrollment)
          })

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
  const completedCount = allProgramCourses.filter(
    (course) => course.enrollment?.status === EnrollmentStatus.Completed,
  ).length

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
          MITx | {program?.programType}
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
        const sectionCompletedCount = section.courses.filter(
          (course) => course.enrollment?.status === EnrollmentStatus.Completed,
        ).length

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
              {section.courses.map((course) => (
                <DashboardCardStyled
                  titleAction="marketing"
                  key={course.key}
                  dashboardResource={course}
                  showNotComplete={false}
                  variant="stacked"
                />
              ))}
            </StackedCardContainer>
          </React.Fragment>
        )
      })}
    </Stack>
  )
}

const AllEnrollmentsDisplay: React.FC = () => {
  const { data: enrolledCourses, isLoading: courseEnrollmentsLoading } =
    useQuery({
      ...enrollmentQueries.courseRunEnrollmentsList(),
      select: userEnrollmentsToDashboardCourses,
    })
  const { data: contracts, isLoading: contractsLoading } = useQuery(
    contractQueries.contractsList(),
  )
  const { data: programEnrollments, isLoading: programEnrollmentsLoading } =
    useQuery(enrollmentQueries.programEnrollmentsList())
  const filteredProgramEnrollments = programEnrollments
    ? programEnrollmentsToPrograms(programEnrollments, contracts)
    : []

  const { completed, expired, started, notStarted } = sortEnrollments(
    enrolledCourses || [],
  )
  const shownEnrollments = [...started, ...notStarted, ...completed]

  return shownEnrollments.length > 0 ? (
    <Wrapper>
      <Title variant="h5" component="h2">
        My Learning
      </Title>
      <EnrollmentExpandCollapse
        shownCourseRunEnrollments={shownEnrollments}
        hiddenCourseRunEnrollments={expired}
        programEnrollments={filteredProgramEnrollments || []}
        isLoading={
          courseEnrollmentsLoading ||
          programEnrollmentsLoading ||
          contractsLoading
        }
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
