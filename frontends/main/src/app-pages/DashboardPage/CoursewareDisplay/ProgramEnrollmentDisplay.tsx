import React, { useEffect } from "react"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import {
  SimpleSelectField,
  Skeleton,
  Stack,
  Typography,
  styled,
  theme,
} from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { useQuery } from "@tanstack/react-query"
import { getRequirementsProgress, getKey, ResourceType } from "./helpers"
import { DashboardCard, DashboardType } from "./DashboardCard"
import {
  getDistinctDashboardLanguageOptions,
  groupCourseRunEnrollmentsByCourseId,
  groupProgramEnrollmentsByProgramId,
  resolveSlotForLanguage,
} from "./model/dashboardViewModel"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { programsQueries } from "api/mitxonline-hooks/programs"
import {
  CourseWithCourseRunsSerializerV2,
  DisplayModeEnum,
  V2ProgramDetail,
  V2ProgramRequirement,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import NotFoundPage from "@/app-pages/ErrorPage/NotFoundPage"
import { ProgramAsCourseCard } from "./ProgramAsCourseCard"
import { getIdsFromReqTree } from "@/common/mitxonline"
import { RiAwardFill } from "@remixicon/react"

const DashboardCardStyled = styled(DashboardCard)({
  borderRadius: "8px",
  boxShadow: "0px 1px 6px 0px rgba(3, 21, 45, 0.05)",
})

const ProgramLanguageSelect = styled(SimpleSelectField)(({ theme }) => ({
  display: "inline-flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "8px",
  width: "auto",
  "> *:not(:last-child)": {
    marginBottom: "0",
  },
  "> label": {
    marginBottom: "0",
    whiteSpace: "nowrap",
  },
  "> .MuiInputBase-root": {
    width: "fit-content",
    maxWidth: "100%",
  },
  [theme.breakpoints.down("sm")]: {
    "> .MuiInputBase-root": {
      width: "fit-content",
      maxWidth: "100%",
    },
  },
})) as typeof SimpleSelectField

export const ProgramCertificateButton = styled(ButtonLink)(({ theme }) => ({
  color: theme.custom.colors.red,
  width: "120px",
}))

interface ResourceItem {
  id: number
  type: "course" | "program"
}

type CourseRequirementItem = {
  resourceType: "course"
  course: CourseWithCourseRunsSerializerV2
}

type ProgramAsCourseRequirementItem = {
  resourceType: "program-as-course"
  courseProgramId: number
  courseProgram: V2ProgramDetail
  courseProgramEnrollment: V3UserProgramEnrollment | undefined
}

type ProgramEnrollmentRequirementItem = {
  resourceType: "program-enrollment"
  enrollment: V3UserProgramEnrollment
}

type RequirementSectionItem =
  | CourseRequirementItem
  | ProgramAsCourseRequirementItem
  | ProgramEnrollmentRequirementItem

type RequirementSection = {
  key: string | number | null | undefined
  title: string
  items: RequirementSectionItem[]
  node: V2ProgramRequirement
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

  const requiredProgramList = React.useMemo(
    () => requiredPrograms?.results ?? [],
    [requiredPrograms?.results],
  )

  const programAsCourseCourseIds = React.useMemo(() => {
    const uniqueIds = new Set<number>()

    requiredProgramList
      .filter(
        (requiredProgram) =>
          requiredProgram.display_mode === DisplayModeEnum.Course,
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

  const enrollmentsByCourseId = groupCourseRunEnrollmentsByCourseId(
    rawEnrollments ?? [],
  )

  const programEnrollmentsById = groupProgramEnrollmentsByProgramId(
    programEnrollments ?? [],
  )

  const allProgramCourses = React.useMemo(
    () => programCourses?.results ?? [],
    [programCourses?.results],
  )
  const languageOptions = React.useMemo(
    () =>
      getDistinctDashboardLanguageOptions(
        allProgramCourses,
        rawEnrollments ?? [],
      ),
    [allProgramCourses, rawEnrollments],
  )
  const [selectedLanguageKey, setSelectedLanguageKey] = React.useState("")
  useEffect(() => {
    if (languageOptions.length === 0) {
      if (selectedLanguageKey) {
        setSelectedLanguageKey("")
      }
      return
    }
    const hasSelectedLanguage = languageOptions.some(
      (option) => option.value === selectedLanguageKey,
    )
    if (!hasSelectedLanguage) {
      setSelectedLanguageKey(String(languageOptions[0].value))
    }
  }, [languageOptions, selectedLanguageKey])

  const requirementSections: RequirementSection[] =
    program?.req_tree
      .filter((node) => node.data.node_type === "operator")
      .map((node) => {
        const coursesById = new Map(
          (programCourses?.results ?? []).map((c) => [c.id, c]),
        )
        const programsById = new Map(requiredProgramList.map((p) => [p.id, p]))

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
              requiredProgram.display_mode === DisplayModeEnum.Course

            if (isProgramAsCourse) {
              return {
                resourceType: "program-as-course" as const,
                courseProgramId: requiredProgram.id,
                courseProgram: requiredProgram,
                courseProgramEnrollment:
                  programEnrollmentsById[requiredProgram.id],
              }
            }

            const enrollment = programEnrollmentsById[requiredProgram.id]
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

  const { completed: completedCount, total: totalCount } =
    getRequirementsProgress(
      requirementSections.map((s) => s.node),
      enrollmentsByCourseId,
      programEnrollmentsById,
    )

  const programCertificateUrl = programEnrollment?.certificate?.link ?? null

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
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h5" color={theme.custom.colors.silverGrayDark}>
            Program
            {program?.program_type ? `: ${program?.program_type}` : ""}
          </Typography>
          {languageOptions.length > 1 && (
            <ProgramLanguageSelect
              size="small"
              label="Learning Language:"
              value={selectedLanguageKey}
              onChange={(e) => setSelectedLanguageKey(String(e.target.value))}
              options={languageOptions}
              renderValue={(value) => {
                const selected = languageOptions.find(
                  (opt) => opt.value === value,
                )
                return String(selected?.label ?? "")
              }}
            />
          )}
        </Stack>
        <Typography component="h1" variant="h3" paddingBottom="32px">
          {program?.title}
        </Typography>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2">
            You have completed
            <Typography component="span" variant="subtitle2">
              {` ${completedCount} of ${totalCount} courses `}
            </Typography>
            for this program.
          </Typography>
          <Stack direction="column" alignItems="flex-end" gap="8px">
            {programCertificateUrl && (
              <ProgramCertificateButton
                variant="bordered"
                size="small"
                startIcon={<RiAwardFill />}
                href={programCertificateUrl}
              >
                Certificate
              </ProgramCertificateButton>
            )}
          </Stack>
        </Stack>
      </Stack>
      {requirementSections.map((section, index) => {
        const { completed: sectionCompleted, total: sectionTotal } =
          getRequirementsProgress(
            [section.node],
            enrollmentsByCourseId,
            programEnrollmentsById,
          )

        return (
          <React.Fragment key={section.key}>
            <Stack
              direction="row"
              justifyContent="space-between"
              marginBottom="16px"
              marginTop={index > 0 ? "32px" : "0"}
            >
              <Typography
                component="h2"
                variant="subtitle2"
                color={theme.custom.colors.red}
              >
                {section.title}
              </Typography>
              {sectionTotal > 0 ? (
                <Typography
                  data-testid="section-completion-count"
                  variant="body2"
                  color={theme.custom.colors.silverGrayDark}
                >
                  Completed {sectionCompleted} of {sectionTotal}
                </Typography>
              ) : null}
            </Stack>
            <Stack direction="column" gap="16px">
              {section.items.map((item) => {
                if (item.resourceType === "course") {
                  const courseEnrollments =
                    enrollmentsByCourseId[item.course.id] || []
                  const { displayedEnrollment, displayedRun } =
                    resolveSlotForLanguage(
                      item.course,
                      courseEnrollments,
                      selectedLanguageKey,
                    )

                  const resource = displayedEnrollment
                    ? {
                        type: DashboardType.CourseRunEnrollment,
                        data: displayedEnrollment,
                      }
                    : { type: DashboardType.Course, data: item.course }

                  const runId = displayedEnrollment?.run.id ?? displayedRun?.id

                  return (
                    <DashboardCardStyled
                      key={getKey({
                        resourceType: ResourceType.Course,
                        id: item.course.id,
                        runId,
                      })}
                      resource={resource}
                      programEnrollment={programEnrollment}
                      showNotComplete={false}
                      selectedCourseRun={displayedRun}
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
                      ancestorProgramEnrollment={
                        programEnrollment
                          ? {
                              readable_id:
                                programEnrollment.program.readable_id,
                              enrollment_mode:
                                programEnrollment.enrollment_mode,
                            }
                          : undefined
                      }
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

export { ProgramEnrollmentDisplay }
