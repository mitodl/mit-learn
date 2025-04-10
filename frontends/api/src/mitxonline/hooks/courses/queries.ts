import { queryOptions } from "@tanstack/react-query"
import type {
  CoursesApiApiV2CoursesListRequest,
  PaginatedCourseWithCourseRunsList,
} from "../../generated/v0"

import * as data from "./data"
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
        if (process.env.NODE_ENV === "test") {
          /**
           * For now, only use the API client during tests so we
           * can mock it the way we normally do.
           */
          return coursesApi.apiV2CoursesList(opts).then((res) => res.data)
        }
        const ids = opts?.id ?? []
        const courses =
          ids.length === 0
            ? data.universalAiCourses
            : data.universalAiCourses.filter((c) => ids.includes(c.id))
        if (courses.length === 0) {
          console.error("No mock courses matching the given ids found.", {
            ids,
          })
        }
        return {
          count: courses.length,
          next: null,
          previous: null,
          results: courses,
        }
      },
    }),
}

export { coursesQueries, coursesKeys }
