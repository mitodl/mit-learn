import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Skeleton, Stack, Typography, styled, theme } from "ol-components"
import {
  EnrollmentStatus,
  getCourseRunEnrollmentStatus,
  getKey,
  ResourceType,
  selectBestEnrollment,
} from "./helpers"
import { DashboardCard, DashboardType } from "./DashboardCard"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { V2ProgramRequirement } from "@mitodl/mitxonline-api-axios/v2"
import NotFoundPage from "@/app-pages/ErrorPage/NotFoundPage"

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

export const ProgramEnrollmentDisplay: React.FC<
  ProgramEnrollmentDisplayProps
> = ({ programId }) => {
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
        const coursesById = new Map(
          (programCourses?.results ?? []).map((c) => [c.id, c]),
        )
        const sectionCourses = courseIds
          .map((id) => coursesById.get(id))
          .filter((c) => c !== undefined)
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
    return (
      getCourseRunEnrollmentStatus(bestEnrollment) ===
      EnrollmentStatus.Completed
    )
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
            getCourseRunEnrollmentStatus(bestEnrollment) ===
            EnrollmentStatus.Completed
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
            </StackedCardContainer>
          </React.Fragment>
        )
      })}
    </Stack>
  )
}
