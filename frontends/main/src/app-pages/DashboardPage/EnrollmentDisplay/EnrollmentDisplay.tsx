import React from "react"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { PlainList, Typography, styled } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import { mitxonlineCoursesToEnrollment } from "./transform"
import { EnrollmentCard } from "./EnrollmentCard"
import { EnrollmentData } from "./types"

const Wrapper = styled.div(({ theme }) => ({
  marginTop: "32px",
  padding: "24px 32px",
  backgroundColor: theme.custom.colors.white,
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  boxShadow: "0px 4px 8px 0px rgba(19, 20, 21, 0.08)",
  borderRadius: "8px",
}))

const alphabeticalSort = (a: EnrollmentData, b: EnrollmentData) =>
  a.title.localeCompare(b.title)

const startsSooner = (a: EnrollmentData, b: EnrollmentData) => {
  if (!a.startDate && !b.startDate) return 0
  if (!a.startDate) return 1
  if (!b.startDate) return -1
  const x = new Date(a.startDate)
  const y = new Date(b.startDate)
  return x.getTime() - y.getTime()
}
const sortEnrollments = (enrollments: EnrollmentData[]) => {
  const ended: EnrollmentData[] = []
  const started: EnrollmentData[] = []
  const notStarted: EnrollmentData[] = []
  enrollments.forEach((enrollment) => {
    if (
      enrollment.hasUserCompleted ||
      (enrollment.endDate && new Date(enrollment.endDate) < new Date())
    ) {
      ended.push(enrollment)
    } else if (
      enrollment.startDate &&
      new Date(enrollment.startDate) < new Date()
    ) {
      started.push(enrollment)
    } else {
      notStarted.push(enrollment)
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
    select: mitxonlineCoursesToEnrollment,
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
            <EnrollmentCard enrollment={course} />
          </li>
        ))}
      </PlainList>
    </Wrapper>
  )
}

export { EnrollmentDisplay }
