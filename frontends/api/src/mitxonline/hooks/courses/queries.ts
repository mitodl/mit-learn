import { queryOptions } from "@tanstack/react-query"
import type {
  CoursesApiApiV2CoursesListRequest,
  PaginatedCourseWithCourseRunsList,
} from "@mitodl/mitxonline-api-axios/v1"
import { coursesApi } from "../../clients"

const coursesKeys = {
  root: ["mitxonline", "courses"],
  coursesList: (opts?: CoursesApiApiV2CoursesListRequest) => [
    ...coursesKeys.root,
    "list",
    opts,
  ],
}

const coursesQueries = {
  coursesList: (opts?: CoursesApiApiV2CoursesListRequest) =>
    queryOptions({
      queryKey: coursesKeys.coursesList(opts),
      queryFn: async (): Promise<PaginatedCourseWithCourseRunsList> => {
        return coursesApi.apiV2CoursesList(opts).then((res) => res.data)
      },
    }),
}

export { coursesQueries, coursesKeys }
