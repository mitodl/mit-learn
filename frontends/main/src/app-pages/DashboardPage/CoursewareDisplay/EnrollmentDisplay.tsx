import React from "react"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import {
  Collapse,
  Link,
  PlainList,
  PlainListProps,
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
import {
  DashboardCourse,
  DashboardCourseEnrollment,
  DashboardProgram,
  EnrollmentStatus,
} from "./types"
import type { AxiosError } from "axios"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { Button } from "@mitodl/smoot-design"
import { RiArrowLeftLine } from "@remixicon/react"
import { useRouter } from "next-nprogress-bar"
import { DASHBOARD_HOME, programView } from "@/common/urls"

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
  const router = useRouter()

  const handleToggle = (event: React.MouseEvent) => {
    event.preventDefault()
    setShown(!shown)
  }

  const handleViewProgram = (programId: number) => {
    router.push(programView(programId))
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
            buttonClick={() => handleViewProgram(program.id)}
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

interface ProgramEnrollmentDisplayProps {
  programId: number
}

const ProgramEnrollmentDisplay: React.FC<ProgramEnrollmentDisplayProps> = ({
  programId,
}) => {
  const router = useRouter()
  const { data: userCourses, isLoading: userEnrollmentsLoading } = useQuery({
    ...enrollmentQueries.courseRunEnrollmentsList(),
    select: userEnrollmentsToDashboardCourses,
  })
  const { data: rawProgram, isLoading: programLoading } = useQuery(
    programsQueries.programDetail({ id: programId }),
  )
  const program = rawProgram ? mitxonlineProgram(rawProgram) : undefined
  const { data: rawProgramCourses, isLoading: programCoursesLoading } =
    useQuery(coursesQueries.coursesList({ id: program?.courseIds }))
  const programCourses = rawProgramCourses?.results.map((course) => {
    const enrollment = userCourses?.find((dashboardCourse) =>
      course.courseruns.some(
        (run) => run.courseware_id === dashboardCourse.coursewareId,
      ),
    )?.enrollment
    return mitxonlineCourse(course, enrollment)
  })
  const rawProgramCourseEnrollments = userCourses?.filter((course) => {
    return rawProgramCourses?.results.some((programCourse) =>
      programCourse.courseruns.some(
        (run) => run.courseware_id === course.coursewareId,
      ),
    )
  })
  const programCourseEnrollments = rawProgramCourseEnrollments
    ?.map((course) => {
      return course.enrollment ?? undefined
    })
    .filter(
      (enrollment) => enrollment !== undefined,
    ) as DashboardCourseEnrollment[]
  const completedEnrollments = programCourseEnrollments?.filter(
    (enrollment) => enrollment.status === EnrollmentStatus.Completed,
  )
  return (
    <>
      <Stack direction="column">
        <Stack
          direction="row"
          justifyContent="space-between"
          marginBottom="24px"
        >
          <Stack direction="column">
            <Typography variant="h5" color={theme.custom.colors.silverGrayDark}>
              MITx | {program?.programType}
            </Typography>
            <Typography variant="h3" paddingBottom="32px">
              {program?.title}
            </Typography>
            <Typography variant="body2">
              You have completed
              <Typography component="span" variant="subtitle2">
                {" "}
                {completedEnrollments?.length} of {programCourses?.length}{" "}
                courses{" "}
              </Typography>
              for this program.
            </Typography>
          </Stack>
          <Stack direction="column">
            <Button
              variant="tertiary"
              size="small"
              startIcon={<RiArrowLeftLine />}
              onClick={() => router.push(DASHBOARD_HOME)}
            >
              Back
            </Button>
          </Stack>
        </Stack>
        <Stack
          direction="row"
          justifyContent="space-between"
          marginBottom="16px"
        >
          <Typography variant="subtitle2" color={theme.custom.colors.red}>
            Core Courses
          </Typography>
          <Typography
            variant="body2"
            color={theme.custom.colors.silverGrayDark}
          >
            Completed {completedEnrollments?.length} of {programCourses?.length}
          </Typography>
        </Stack>
        <StackedCardContainer>
          {programCourses?.map((course) => (
            <DashboardCardStyled
              titleAction="marketing"
              key={course.key}
              dashboardResource={course}
              showNotComplete={false}
              variant="stacked"
              isLoading={
                userEnrollmentsLoading ||
                programLoading ||
                programCoursesLoading
              }
            />
          ))}
        </StackedCardContainer>
      </Stack>
    </>
  )
}

const AllEnrollmentsDisplay: React.FC = () => {
  const onError = (error: Error) => {
    const err = error as AxiosError<{ detail?: string }>
    const status = err?.response?.status
    if (
      status === 403 &&
      err.response?.data?.detail ===
        "Authentication credentials were not provided."
    ) {
      // For now, we don't want to throw an error if the user is not authenticated.
      return false
    }
    return true
  }

  const { data: enrolledCourses, isLoading: courseEnrollmentsLoading } =
    useQuery({
      ...enrollmentQueries.courseRunEnrollmentsList(),
      select: userEnrollmentsToDashboardCourses,
      throwOnError: onError,
    })

  const { data: programEnrollments, isLoading: programEnrollmentsLoading } =
    useQuery({
      ...enrollmentQueries.programEnrollmentsList(),
      select: programEnrollmentsToPrograms,
      throwOnError: onError,
    })

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
        programEnrollments={programEnrollments || []}
        isLoading={courseEnrollmentsLoading || programEnrollmentsLoading}
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
