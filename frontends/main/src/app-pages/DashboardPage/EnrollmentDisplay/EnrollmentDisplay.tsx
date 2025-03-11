import React from "react"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { PlainList, Typography, styled } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import { mitxonlineCoursesToEnrollment } from "./transform"
import { EnrollmentCard } from "./EnrollmentCard"

const Wrapper = styled.div({
  marginTop: "24px",
})

const EnrollmentDisplay = () => {
  const { data: enrolledCourses } = useQuery({
    ...enrollmentQueries.coursesList(),
    select: mitxonlineCoursesToEnrollment,
  })
  return (
    <Wrapper>
      <Typography variant="h3" component="h2" sx={{ marginBottom: "16px" }}>
        Your Courses
      </Typography>
      <PlainList itemSpacing={1.5}>
        {enrolledCourses?.map((course) => (
          <li key={course.id}>
            <EnrollmentCard enrollment={course} />
          </li>
        ))}
      </PlainList>
    </Wrapper>
  )
}

export { EnrollmentDisplay }
