import React from "react"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { PlainList, Typography, styled } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import { mitxonlineCoursesToEnrollment } from "./transform"
import { EnrollmentCard } from "./EnrollmentCard"

const Wrapper = styled.div(({ theme }) => ({
  marginTop: "32px",
  padding: "24px 32px",
  backgroundColor: theme.custom.colors.white,
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  boxShadow: "0px 4px 8px 0px rgba(19, 20, 21, 0.08)",
  borderRadius: "8px",
}))

const EnrollmentDisplay = () => {
  const { data: enrolledCourses } = useQuery({
    ...enrollmentQueries.coursesList(),
    select: mitxonlineCoursesToEnrollment,
  })

  return (
    <Wrapper>
      <Typography variant="h5" component="h2" sx={{ marginBottom: "16px" }}>
        My Learning
      </Typography>
      <PlainList itemSpacing={"16px"}>
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
