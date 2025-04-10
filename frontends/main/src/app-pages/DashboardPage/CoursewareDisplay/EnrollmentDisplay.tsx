import React from "react"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import {
  Link,
  PlainList,
  PlainListProps,
  Typography,
  TypographyProps,
  styled,
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

const EnrollmentList = styled(PlainList)<Pick<PlainListProps, "itemSpacing">>(
  ({ theme }) => ({
    [theme.breakpoints.down("md")]: {
      borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
      ">li+li": {
        marginTop: "0",
      },
    },
  }),
)

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
  const ended: DashboardCourse[] = []
  const started: DashboardCourse[] = []
  const notStarted: DashboardCourse[] = []
  resources.forEach((resource) => {
    if (
      resource.enrollment?.status === EnrollmentStatus.Completed ||
      (resource.run.endDate && new Date(resource.run.endDate) < new Date())
    ) {
      ended.push(resource)
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
    ended: ended.sort(alphabeticalSort),
    started: started.sort(alphabeticalSort),
    notStarted: notStarted.sort(startsSooner),
  }
}

interface EnrollmentExpandCollapseProps {
  shownEnrollments: DashboardCourse[]
  hiddenEnrollments: DashboardCourse[]
}

const EnrollmentExpandCollapse: React.FC<EnrollmentExpandCollapseProps> = ({
  shownEnrollments,
  hiddenEnrollments,
}) => {
  const [shown, setShown] = React.useState(false)
  const enrollments = shown
    ? shownEnrollments.concat(hiddenEnrollments)
    : shownEnrollments
  return (
    <>
      <EnrollmentList itemSpacing={"16px"}>
        {enrollments.map((course) => (
          <DashboardCardStyled
            key={course.id}
            Component="li"
            dashboardResource={course}
            showNotComplete={false}
          />
        ))}
      </EnrollmentList>
      <ShowAllContainer>
        <Link color="red" size="medium" onClick={() => setShown(!shown)}>
          {shown ? "Show less" : "Show all"}
        </Link>
      </ShowAllContainer>
    </>
  )
}

const EnrollmentDisplay = () => {
  const { data: enrolledCourses } = useQuery({
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
  const { ended, started, notStarted } = sortEnrollments(enrolledCourses || [])
  const shownEnrollments = [...started, ...notStarted]

  return (
    <Wrapper>
      <Title variant="h5" component="h2">
        My Learning
      </Title>
      <EnrollmentExpandCollapse
        shownEnrollments={shownEnrollments}
        hiddenEnrollments={ended}
      />
    </Wrapper>
  )
}

export { EnrollmentDisplay }
