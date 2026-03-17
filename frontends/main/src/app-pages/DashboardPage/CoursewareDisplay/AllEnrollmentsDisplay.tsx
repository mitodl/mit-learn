import React from "react"
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
import { useQuery } from "@tanstack/react-query"
import {
  EnrollmentStatus,
  getCourseRunEnrollmentStatus,
  getKey,
  ResourceType,
} from "./helpers"
import {
  DashboardCard,
  DashboardResource,
  DashboardType,
} from "./DashboardCard"
import { CourseRunEnrollmentV3 } from "@mitodl/mitxonline-api-axios/v2"
import { contractQueries } from "api/mitxonline-hooks/contracts"

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
      "> li+li": {
        marginTop: "0",
      },
      "> li:nth-child(n+3)": {
        marginTop: "16px",
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

const alphabeticalSort = (
  a: CourseRunEnrollmentV3,
  b: CourseRunEnrollmentV3,
) => a.run.course.title.localeCompare(b.run.course.title)

const startsSooner = (
  a: CourseRunEnrollmentV3,
  b: CourseRunEnrollmentV3,
) => {
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
      const enrollmentStatus = getCourseRunEnrollmentStatus(enrollment)
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

interface EnrollmentExpandCollapseProps {
  normallyShown: DashboardResource[]
  maybeShown: DashboardResource[]
  isLoading?: boolean
  onUpgradeError?: (error: string) => void
}

const EnrollmentExpandCollapse: React.FC<EnrollmentExpandCollapseProps> = ({
  normallyShown,
  maybeShown,
  isLoading,
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
        {shownResources.map((resource) => (
          <DashboardCardStyled
            key={getResourceKey(resource)}
            Component="li"
            resource={resource}
            showNotComplete={false}
            isLoading={isLoading}
            onUpgradeError={onUpgradeError}
          />
        ))}
      </EnrollmentsList>
      {hiddenResources.length === 0 ? null : (
        <>
          <Collapse orientation="vertical" in={shown}>
            <HiddenEnrollmentsList itemSpacing={"16px"}>
              {hiddenResources.map((resource) => (
                <DashboardCardStyled
                  key={getResourceKey(resource)}
                  Component="li"
                  resource={resource}
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

const MIN_VISIBLE = 3

interface AllEnrollmentsDisplayProps {
  title?: string
}

const AllEnrollmentsDisplay: React.FC<AllEnrollmentsDisplayProps> = ({
  title = "My Learning",
}) => {
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
        {title}
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
          contractsLoading
        }
        onUpgradeError={setUpgradeError}
      />
    </Wrapper>
  ) : null
}

export { AllEnrollmentsDisplay }
