import React from "react"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { Typography, styled } from "ol-components"
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
      <Typography variant="h3" component="h2">
        Your Courses
      </Typography>
      {enrolledCourses?.map((course) => (
        <EnrollmentCard key={course.id} {...course} />
      ))}
    </Wrapper>
  )
}

export { EnrollmentDisplay }
