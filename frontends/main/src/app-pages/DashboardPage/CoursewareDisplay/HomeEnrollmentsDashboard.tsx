import React from "react"
import { DASHBOARD_MY_LEARNING_ID } from "@/common/urls"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import {
  Collapse,
  Link,
  PlainList,
  PlainListProps,
  Typography,
  TypographyProps,
  styled,
  theme,
} from "ol-components"
import { Alert } from "@mitodl/smoot-design"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  EnrollmentStatus,
  getEnrollmentStatus,
  getKey,
  ResourceType,
} from "./helpers"
import {
  DashboardCard,
  DashboardResource,
  DashboardType,
} from "./DashboardCard"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { programsQueries } from "api/mitxonline-hooks/programs"
import {
  ContractPage,
  CourseRunEnrollmentV3,
  CourseWithCourseRunsSerializerV2,
  DisplayModeEnum,
  V2ProgramDetail,
  V2ProgramRequirement,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { ProgramAsCourseCard } from "./ProgramAsCourseCard"
import { getIdsFromReqTree } from "@/common/mitxonline"

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

const alphabeticalSort = (a: CourseRunEnrollmentV3, b: CourseRunEnrollmentV3) =>
  a.run.course.title.localeCompare(b.run.course.title)

const startsSooner = (a: CourseRunEnrollmentV3, b: CourseRunEnrollmentV3) => {
  if (!a.run.start_date && !b.run.start_date) return 0
  if (!a.run.start_date) return 1
  if (!b.run.start_date) return -1
  const x = new Date(a.run.start_date)
  const y = new Date(b.run.start_date)
  return x.getTime() - y.getTime()
}

const sortEnrollments = (enrollments: CourseRunEnrollmentV3[]) => {
  const expired: CourseRunEnrollmentV3[] = []
  const completed: CourseRunEnrollmentV3[] = []
  const started: CourseRunEnrollmentV3[] = []
  const notStarted: CourseRunEnrollmentV3[] = []
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

const dedupeEnrollments = (
  enrollments: CourseRunEnrollmentV3[],
  enrolledPrograms: V2ProgramDetail[],
) => {
  return enrollments.filter((enrollment) => {
    return !enrolledPrograms.some((program) =>
      program.courses?.includes(enrollment.run.course.id),
    )
  })
}

const getResourceKey = (resource: DashboardResource): string => {
  if (resource.type === DashboardType.ProgramEnrollment) {
    return getKey({
      resourceType: ResourceType.Program,
      id: resource.data.program.id,
    })
  }
  if (resource.type === DashboardType.CourseRunEnrollment) {
    return getKey({
      resourceType: ResourceType.Course,
      id: resource.data.run.course.id,
      runId: resource.data.run.id,
    })
  }
  return getKey({ resourceType: ResourceType.Course, id: resource.data.id })
}

type ProgramEnrollmentResource = Extract<
  DashboardResource,
  { type: typeof DashboardType.ProgramEnrollment }
>

const isProgramAsCourseEnrollment = (
  resource: DashboardResource,
): resource is ProgramEnrollmentResource => {
  if (resource.type !== DashboardType.ProgramEnrollment) return false
  return resource.data.program.display_mode === DisplayModeEnum.Course
}

type ProgramAsCourseProgramData = {
  id: number
  readable_id: string
  title?: string | null
  start_date?: string | null
  end_date?: string | null
  courses?: number[]
  req_tree?: V2ProgramRequirement[]
}

interface EnrollmentExpandCollapseProps {
  normallyShown: DashboardResource[]
  maybeShown: DashboardResource[]
  isLoading?: boolean
  enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]>
  courseProgramsById: Map<number, ProgramAsCourseProgramData>
  moduleCoursesByProgramId: Record<number, CourseWithCourseRunsSerializerV2[]>
  onUpgradeError?: (error: string) => void
}

const MIN_VISIBLE = 3

const EnrollmentExpandCollapse: React.FC<EnrollmentExpandCollapseProps> = ({
  normallyShown,
  maybeShown,
  isLoading,
  enrollmentsByCourseId,
  courseProgramsById,
  moduleCoursesByProgramId,
  onUpgradeError,
}) => {
  const [shown, setShown] = React.useState(false)

  const handleToggle = (event: React.MouseEvent) => {
    event.preventDefault()
    setShown(!shown)
  }

  const shownResources = normallyShown.length
    ? normallyShown
    : maybeShown.slice(0, MIN_VISIBLE)
  const hiddenResources = normallyShown.length
    ? maybeShown
    : maybeShown.slice(MIN_VISIBLE)

  const renderResource = (resource: DashboardResource) => {
    if (isProgramAsCourseEnrollment(resource)) {
      const courseProgram = courseProgramsById.get(resource.data.program.id)
      if (!courseProgram) {
        return (
          <DashboardCardStyled
            key={getResourceKey(resource)}
            Component="li"
            resource={resource}
            showNotComplete={false}
            isLoading={isLoading}
            onUpgradeError={onUpgradeError}
          />
        )
      }

      return (
        <ProgramAsCourseCard
          key={getResourceKey(resource)}
          Component="li"
          courseProgram={courseProgram}
          moduleCourses={
            moduleCoursesByProgramId[resource.data.program.id] ?? []
          }
          moduleEnrollmentsByCourseId={enrollmentsByCourseId}
          courseProgramEnrollment={resource.data}
        />
      )
    }

    return (
      <DashboardCardStyled
        key={getResourceKey(resource)}
        Component="li"
        resource={resource}
        showNotComplete={false}
        isLoading={isLoading}
        onUpgradeError={onUpgradeError}
      />
    )
  }

  return (
    <>
      <EnrollmentsList itemSpacing={"16px"}>
        {shownResources.map(renderResource)}
      </EnrollmentsList>
      {hiddenResources.length === 0 ? null : (
        <>
          <Collapse orientation="vertical" in={shown}>
            <HiddenEnrollmentsList itemSpacing={"16px"}>
              {hiddenResources.map(renderResource)}
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

const getTopLevelProgramEnrollments = (
  programEnrollments: V3UserProgramEnrollment[],
  programs: V2ProgramDetail[],
) => {
  const childIds = new Set(
    programs.flatMap(
      (program) => getIdsFromReqTree(program.req_tree).programIds,
    ),
  )
  return programEnrollments.filter(
    (enrollment) => !childIds.has(enrollment.program.id),
  )
}
const getNonContractProgramEnrollments = (
  programEnrollments: V3UserProgramEnrollment[],
  contracts: ContractPage[],
) => {
  const contractPrograms = new Set(
    contracts.flatMap((contract) => contract.programs),
  )
  return programEnrollments.filter(
    (enrollment) => !contractPrograms.has(enrollment.program.id),
  )
}

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
const HomeEnrollmentsDashboard: React.FC = () => {
  const [upgradeError, setUpgradeError] = React.useState<string | null>(null)
  const { data: enrolledCourses, isLoading: courseEnrollmentsLoading } =
    useQuery(enrollmentQueries.courseRunEnrollmentsList())

  const contracts = useQuery({
    ...mitxUserQueries.me(), // this query has the contracts and should already be loaded
    select: (user) => user.b2b_organizations.flatMap((org) => org.contracts),
  })
  const { data: programEnrollments, isLoading: programEnrollmentsLoading } =
    useQuery(enrollmentQueries.programEnrollmentsList())
  const nonContractProgramEnrollments =
    contracts.data && programEnrollments
      ? getNonContractProgramEnrollments(programEnrollments, contracts.data)
      : []
  const enrolledProgramIds = nonContractProgramEnrollments.map(
    (enrollment) => enrollment.program.id,
  )

  const { data: enrolledPrograms, isLoading: enrolledProgramsLoading } =
    useQuery({
      ...programsQueries.programsList({
        id: enrolledProgramIds,
        page_size: enrolledProgramIds.length,
      }),
      enabled: enrolledProgramIds.length > 0,
      // If the query key changes, show the old data while loading
      // example: Deleting a program enrollment
      placeholderData: keepPreviousData,
    })

  const filteredProgramEnrollments = enrolledPrograms
    ? getTopLevelProgramEnrollments(
        nonContractProgramEnrollments,
        enrolledPrograms.results,
      )
    : []

  const homeCoursePrograms = enrolledPrograms?.results.filter(
    (program) => program.display_mode === DisplayModeEnum.Course,
  )

  const homeCourseProgramModuleIds = [
    ...new Set(
      homeCoursePrograms?.flatMap(
        (courseProgram) => getIdsFromReqTree(courseProgram.req_tree).courseIds,
      ),
    ),
  ]

  const {
    data: homeCourseProgramModuleCourses,
    isLoading: homeCourseProgramModuleCoursesLoading,
  } = useQuery({
    ...coursesQueries.coursesList({
      id: homeCourseProgramModuleIds,
      page_size: homeCourseProgramModuleIds.length || undefined,
    }),
    enabled: homeCourseProgramModuleIds.length > 0,
    placeholderData: keepPreviousData,
  })

  const homeCourseProgramsById = new Map(
    (homeCoursePrograms ?? []).map((courseProgram) => [
      courseProgram.id,
      courseProgram,
    ]),
  )

  const homeModuleCoursesByProgramId = (() => {
    const allCourses = homeCourseProgramModuleCourses?.results ?? []

    return (homeCoursePrograms ?? []).reduce<
      Record<number, CourseWithCourseRunsSerializerV2[]>
    >((acc, courseProgram) => {
      const courseIds = new Set(courseProgram.courses ?? [])
      acc[courseProgram.id] = allCourses.filter((course) =>
        courseIds.has(course.id),
      )
      return acc
    }, {})
  })()

  const homeEnrollmentsByCourseId = (enrolledCourses || []).reduce(
    (acc, enrollment) => {
      const courseId = enrollment.run.course.id
      if (!acc[courseId]) {
        acc[courseId] = []
      }
      acc[courseId].push(enrollment)
      return acc
    },
    {} as Record<number, CourseRunEnrollmentV3[]>,
  )

  const supportEmail = process.env.NEXT_PUBLIC_MITOL_SUPPORT_EMAIL || ""

  const filteredEnrollments = React.useMemo(() => {
    if (!enrolledCourses) return []
    return dedupeEnrollments(enrolledCourses, enrolledPrograms?.results ?? [])
  }, [enrolledCourses, enrolledPrograms?.results])
  const { completed, expired, started, notStarted } =
    sortEnrollments(filteredEnrollments)

  const normallyShown: DashboardResource[] = [
    ...started.map((data) => ({
      data,
      type: DashboardType.CourseRunEnrollment,
    })),
    ...notStarted.map((data) => ({
      data,
      type: DashboardType.CourseRunEnrollment,
    })),
    ...completed.map((data) => ({
      data,
      type: DashboardType.CourseRunEnrollment,
    })),
    ...filteredProgramEnrollments.map((data) => ({
      data,
      type: DashboardType.ProgramEnrollment,
    })),
  ]
  const maybeShown: DashboardResource[] = expired.map((data) => ({
    data,
    type: DashboardType.CourseRunEnrollment,
  }))
  const totalCards = normallyShown.length + maybeShown.length

  return totalCards > 0 ? (
    <Wrapper id={DASHBOARD_MY_LEARNING_ID}>
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
        normallyShown={normallyShown}
        maybeShown={maybeShown}
        isLoading={
          courseEnrollmentsLoading ||
          programEnrollmentsLoading ||
          contracts.isLoading ||
          enrolledProgramsLoading ||
          homeCourseProgramModuleCoursesLoading
        }
        enrollmentsByCourseId={homeEnrollmentsByCourseId}
        courseProgramsById={homeCourseProgramsById}
        moduleCoursesByProgramId={homeModuleCoursesByProgramId}
        onUpgradeError={setUpgradeError}
      />
    </Wrapper>
  ) : null
}

export { HomeEnrollmentsDashboard }
