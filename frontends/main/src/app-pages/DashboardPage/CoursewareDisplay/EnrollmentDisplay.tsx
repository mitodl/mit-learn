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
import {
  DashboardCard,
  DashboardResource,
  DashboardType,
} from "./DashboardCard"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { programsQueries } from "api/mitxonline-hooks/programs"
import {
  CourseRunEnrollmentV3,
  CourseWithCourseRunsSerializerV2,
  V2ProgramRequirement,
} from "@mitodl/mitxonline-api-axios/v2"
import { contractQueries } from "api/mitxonline-hooks/contracts"
import NotFoundPage from "@/app-pages/ErrorPage/NotFoundPage"
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
  return (
    String(resource.data.program.display_mode ?? "").toLowerCase() === "course"
  )
}

type ProgramAsCourseProgramData = {
  id: number
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

  return (
    <>
      <EnrollmentsList itemSpacing={"16px"}>
        {shownResources.map((resource) => {
          if (isProgramAsCourseEnrollment(resource)) {
            const courseProgram = courseProgramsById.get(
              resource.data.program.id,
            )
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
        })}
      </EnrollmentsList>
      {hiddenResources.length === 0 ? null : (
        <>
          <Collapse orientation="vertical" in={shown}>
            <HiddenEnrollmentsList itemSpacing={"16px"}>
              {hiddenResources.map((resource) => {
                if (isProgramAsCourseEnrollment(resource)) {
                  const courseProgram = courseProgramsById.get(
                    resource.data.program.id,
                  )
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
              })}
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

interface ResourceItem {
  id: number
  type: "course" | "program"
}

const extractResourcesFromNode = (
  node: V2ProgramRequirement,
): ResourceItem[] => {
  const resources: ResourceItem[] = []

  if (node.data.node_type === "course" && node.data.course) {
    resources.push({ id: node.data.course, type: "course" })
  } else if (node.data.node_type === "program" && node.data.required_program) {
    resources.push({ id: node.data.required_program, type: "program" })
  }

  if (node.children) {
    node.children.forEach((child) => {
      resources.push(...extractResourcesFromNode(child))
    })
  }

  return resources
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

  const { data: programCourses, isLoading: programCoursesLoading } = useQuery({
    ...coursesQueries.coursesList({
      id: program?.courses || [],
      page_size: program?.courses?.length || undefined,
    }),
    enabled: !!program && program.courses.length > 0 && enrolledInProgram,
  })

  const requiredProgramIds = React.useMemo(() => {
    if (!program?.req_tree) return []

    return [...new Set(getIdsFromReqTree(program.req_tree).programIds)]
  }, [program?.req_tree])

  const { data: requiredPrograms, isLoading: requiredProgramsLoading } =
    useQuery({
      ...programsQueries.programsList({
        id: requiredProgramIds,
        page_size: requiredProgramIds.length || undefined,
      }),
      enabled: Boolean(enrolledInProgram && requiredProgramIds.length > 0),
    })

  const requiredProgramList = requiredPrograms?.results ?? []

  const programAsCourseCourseIds = React.useMemo(() => {
    const uniqueIds = new Set<number>()

    requiredProgramList
      .filter(
        (requiredProgram) =>
          String(requiredProgram.display_mode ?? "").toLowerCase() === "course",
      )
      .forEach((requiredProgram) => {
        requiredProgram.courses?.forEach((courseId) => uniqueIds.add(courseId))
      })

    return [...uniqueIds]
  }, [requiredProgramList])

  const {
    data: requiredProgramCourses,
    isLoading: requiredProgramCoursesLoading,
  } = useQuery({
    ...coursesQueries.coursesList({
      id: programAsCourseCourseIds,
      page_size: programAsCourseCourseIds.length || undefined,
    }),
    enabled: Boolean(enrolledInProgram && programAsCourseCourseIds.length > 0),
  })

  const isLoading =
    userEnrollmentsLoading ||
    programLoading ||
    programEnrollmentsLoading ||
    programCoursesLoading ||
    requiredProgramsLoading ||
    requiredProgramCoursesLoading

  const enrollmentsByCourseId = (rawEnrollments || []).reduce(
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

  const requirementSections =
    program?.req_tree
      .filter((node) => node.data.node_type === "operator")
      .map((node) => {
        const coursesById = new Map(
          (programCourses?.results ?? []).map((c) => [c.id, c]),
        )
        const programsById = new Map(requiredProgramList.map((p) => [p.id, p]))
        const programEnrollmentsById = new Map(
          (programEnrollments ?? []).map((enrollment) => [
            enrollment.program.id,
            enrollment,
          ]),
        )

        const sectionItems = extractResourcesFromNode(node)
          .map((resource) => {
            if (resource.type === "course") {
              const course = coursesById.get(resource.id)
              if (!course) return null
              return {
                resourceType: "course" as const,
                course,
              }
            }

            const requiredProgram = programsById.get(resource.id)
            if (!requiredProgram) return null

            const isProgramAsCourse =
              String(requiredProgram.display_mode ?? "").toLowerCase() ===
              "course"

            if (isProgramAsCourse) {
              return {
                resourceType: "program-as-course" as const,
                courseProgramId: requiredProgram.id,
                courseProgram: requiredProgram,
                courseProgramEnrollment: programEnrollmentsById.get(
                  requiredProgram.id,
                ),
              }
            }

            const enrollment = programEnrollmentsById.get(requiredProgram.id)
            if (!enrollment) return null

            return {
              resourceType: "program-enrollment" as const,
              enrollment,
            }
          })
          .filter((item) => item !== null)

        return {
          key: node.id,
          title: getRequirementSectionTitle(node),
          items: sectionItems,
          node,
        }
      })
      .filter((section) => section.items.length > 0) || []

  const requiredProgramModuleCoursesByProgramId = React.useMemo(() => {
    const courses = requiredProgramCourses?.results ?? []

    return requiredProgramList.reduce<Record<number, typeof courses>>(
      (acc, requiredProgram) => {
        const requiredCourseIds = new Set(requiredProgram.courses ?? [])
        acc[requiredProgram.id] = courses.filter((course) =>
          requiredCourseIds.has(course.id),
        )
        return acc
      },
      {},
    )
  }, [requiredProgramList, requiredProgramCourses?.results])

  const completedCount = requirementSections
    .flatMap((section) => section.items)
    .filter((item) => {
      if (item.resourceType !== "course") return false

      const bestEnrollment = selectBestEnrollment(
        item.course,
        enrollmentsByCourseId[item.course.id] || [],
      )
      return getEnrollmentStatus(bestEnrollment) === EnrollmentStatus.Completed
    }).length

  const totalCount = requirementSections.reduce((sum, section) => {
    if (
      section.node.data.operator === "min_number_of" &&
      section.node.data.operator_value
    ) {
      return sum + parseInt(section.node.data.operator_value, 10)
    }
    return sum + section.items.length
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
        const sectionCompletedCount = section.items.filter((item) => {
          if (item.resourceType !== "course") return false

          const bestEnrollment = selectBestEnrollment(
            item.course,
            enrollmentsByCourseId[item.course.id] || [],
          )
          return (
            getEnrollmentStatus(bestEnrollment) === EnrollmentStatus.Completed
          )
        }).length

        const sectionRequiredCount =
          section.node.data.operator === "min_number_of" &&
          section.node.data.operator_value
            ? parseInt(section.node.data.operator_value, 10)
            : section.items.length

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
            <Stack direction="column" gap="16px">
              {section.items.map((item) => {
                if (item.resourceType === "course") {
                  const bestEnrollment = selectBestEnrollment(
                    item.course,
                    enrollmentsByCourseId[item.course.id] || [],
                  )

                  const resource = bestEnrollment
                    ? {
                        type: DashboardType.CourseRunEnrollment,
                        data: bestEnrollment,
                      }
                    : { type: DashboardType.Course, data: item.course }

                  return (
                    <DashboardCardStyled
                      key={getKey({
                        resourceType: ResourceType.Course,
                        id: item.course.id,
                        runId: bestEnrollment?.run.id,
                      })}
                      resource={resource}
                      programEnrollment={programEnrollment}
                      showNotComplete={false}
                    />
                  )
                }

                if (item.resourceType === "program-as-course") {
                  return (
                    <ProgramAsCourseCard
                      key={getKey({
                        resourceType: ResourceType.Program,
                        id: item.courseProgramId,
                      })}
                      courseProgram={item.courseProgram}
                      moduleCourses={
                        requiredProgramModuleCoursesByProgramId[
                          item.courseProgramId
                        ] ?? []
                      }
                      moduleEnrollmentsByCourseId={enrollmentsByCourseId}
                      courseProgramEnrollment={item.courseProgramEnrollment}
                    />
                  )
                }

                return (
                  <DashboardCardStyled
                    key={getKey({
                      resourceType: ResourceType.Program,
                      id: item.enrollment.program.id,
                    })}
                    resource={{
                      type: DashboardType.ProgramEnrollment,
                      data: item.enrollment,
                    }}
                    showNotComplete={false}
                  />
                )
              })}
            </Stack>
          </React.Fragment>
        )
      })}
    </Stack>
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

  const programAsCourseProgramIds = React.useMemo(
    () =>
      filteredProgramEnrollments
        .filter(
          (enrollment) =>
            String(enrollment.program.display_mode ?? "").toLowerCase() ===
            "course",
        )
        .map((enrollment) => enrollment.program.id),
    [filteredProgramEnrollments],
  )

  const { data: homeCoursePrograms, isLoading: homeCourseProgramsLoading } =
    useQuery({
      ...programsQueries.programsList({
        id: programAsCourseProgramIds,
        page_size: programAsCourseProgramIds.length || undefined,
      }),
      enabled: programAsCourseProgramIds.length > 0,
    })

  const homeCourseProgramModuleIds = React.useMemo(() => {
    const uniqueIds = new Set<number>()
    ;(homeCoursePrograms?.results ?? []).forEach((courseProgram) => {
      ;(courseProgram.courses ?? []).forEach((courseId) =>
        uniqueIds.add(courseId),
      )
    })
    return [...uniqueIds]
  }, [homeCoursePrograms?.results])

  const {
    data: homeCourseProgramModuleCourses,
    isLoading: homeCourseProgramModuleCoursesLoading,
  } = useQuery({
    ...coursesQueries.coursesList({
      id: homeCourseProgramModuleIds,
      page_size: homeCourseProgramModuleIds.length || undefined,
    }),
    enabled: homeCourseProgramModuleIds.length > 0,
  })

  const homeCourseProgramsById = React.useMemo(
    () =>
      new Map(
        (homeCoursePrograms?.results ?? []).map((courseProgram) => [
          courseProgram.id,
          courseProgram,
        ]),
      ),
    [homeCoursePrograms?.results],
  )

  const homeModuleCoursesByProgramId = React.useMemo(() => {
    const allCourses = homeCourseProgramModuleCourses?.results ?? []

    return (homeCoursePrograms?.results ?? []).reduce<
      Record<number, CourseWithCourseRunsSerializerV2[]>
    >((acc, courseProgram) => {
      const courseIds = new Set(courseProgram.courses ?? [])
      acc[courseProgram.id] = allCourses.filter((course) =>
        courseIds.has(course.id),
      )
      return acc
    }, {})
  }, [homeCoursePrograms?.results, homeCourseProgramModuleCourses?.results])

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

  const { completed, expired, started, notStarted } = sortEnrollments(
    enrolledCourses || [],
  )

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
        normallyShown={normallyShown}
        maybeShown={maybeShown}
        isLoading={
          courseEnrollmentsLoading ||
          programEnrollmentsLoading ||
          contractsLoading ||
          homeCourseProgramsLoading ||
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
