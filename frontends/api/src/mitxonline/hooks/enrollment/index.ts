import { useQuery } from "@tanstack/react-query"
import { enrollmentQueries } from "./queries"

const useEnrolledCoursesList = (opts?: { enabled?: boolean }) => {
  return useQuery({
    ...enrollmentQueries.coursesList(),
    ...opts,
  })
}

export { useEnrolledCoursesList, enrollmentQueries }
