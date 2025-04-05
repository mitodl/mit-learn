import React from "react"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { PlainList, Typography, styled } from "ol-components"
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
  const sorted = [...started, ...notStarted, ...ended]

  return (
    <Wrapper>
      <Typography variant="h5" component="h2" sx={{ marginBottom: "16px" }}>
        My Learning
      </Typography>
      <PlainList itemSpacing={"16px"}>
        {sorted?.map((course) => (
          <li key={course.id}>
            <DashboardCard dashboardResource={course} showNotComplete={false} />
          </li>
        ))}
      </PlainList>
    </Wrapper>
  )
}

export { EnrollmentDisplay }
