import { queryOptions } from "@tanstack/react-query"
import type {
  CoursesApiApiV2CoursesListRequest,
  PaginatedV2CourseWithCourseRunsList,
} from "@mitodl/mitxonline-api-axios/v2"
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
      queryFn: async (): Promise<PaginatedV2CourseWithCourseRunsList> => {
        return coursesApi.apiV2CoursesList(opts).then((res) => res.data)
      },
    }),
}

export { coursesQueries, coursesKeys }
