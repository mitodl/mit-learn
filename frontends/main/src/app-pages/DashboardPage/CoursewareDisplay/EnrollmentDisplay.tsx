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
import { useQuery } from "@tanstack/react-query"
import { mitxonlineEnrollments } from "./transform"
import { DashboardCard } from "./DashboardCard"
import { DashboardCourse, EnrollmentStatus } from "./types"

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
  })

  return {
    completed: completed.sort(alphabeticalSort),
    expired: expired.sort(alphabeticalSort),
    started: started.sort(alphabeticalSort),
    notStarted: notStarted.sort(startsSooner),
  }
}

interface EnrollmentExpandCollapseProps {
  shownEnrollments: DashboardCourse[]
  hiddenEnrollments: DashboardCourse[]
  isLoading?: boolean
}

const EnrollmentExpandCollapse: React.FC<EnrollmentExpandCollapseProps> = ({
  shownEnrollments,
  hiddenEnrollments,
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
        {shownEnrollments.map((course) => (
          <DashboardCardStyled
            key={course.id}
            Component="li"
            dashboardResource={course}
            showNotComplete={false}
            isLoading={isLoading}
          />
        ))}
      </EnrollmentsList>
      <Collapse orientation="vertical" in={shown}>
        <HiddenEnrollmentsList itemSpacing={"16px"}>
          {hiddenEnrollments.map((course) => (
            <DashboardCardStyled
              key={course.id}
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
  )
}

const EnrollmentDisplay = () => {
  const { data: enrolledCourses, isLoading } = useQuery({
    ...enrollmentQueries.coursesList(),
    select: mitxonlineEnrollments,
  })

  /**
   * TODO:
   * Consider handling UI logic in a component that expects standardized
   * EnrollmentData objects. This will simplify testing and isolate API calls
   * to the parent
   *
   * The constants below are separate for impending "Show All" functionality.
   * The above TODO could be handled then.
   */
  const { completed, expired, started, notStarted } = sortEnrollments(
    enrolledCourses || [],
  )
  const shownEnrollments = [...started, ...notStarted, ...completed]

  return (
    <Wrapper>
      <Title variant="h5" component="h2">
        My Learning
      </Title>
      <EnrollmentExpandCollapse
        shownEnrollments={shownEnrollments}
        hiddenEnrollments={expired}
        isLoading={isLoading}
      />
    </Wrapper>
  )
}

export { EnrollmentDisplay }
