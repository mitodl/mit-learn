import { queryOptions } from "@tanstack/react-query"
import type {
  CoursesApiApiV2CoursesListRequest,
  PaginatedCourseWithCourseRunsSerializerV2List,
  V2Program,
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
  courseDetailByReadableId: (readableId?: string) =>
    queryOptions({
      queryKey: coursesKeys.coursesList({ readable_id: readableId }),
      queryFn: async () => {
        const res = await coursesApi.apiV2CoursesList({
          readable_id: readableId,
          page_size: 1,
        })
        return res.data.results[0]
      },
    }),
  coursesList: (opts?: CoursesApiApiV2CoursesListRequest) =>
    queryOptions({
      queryKey: coursesKeys.coursesList(opts),
      queryFn:
        async (): Promise<PaginatedCourseWithCourseRunsSerializerV2List> => {
          return coursesApi.apiV2CoursesList(opts).then((res) => res.data)
        },
    }),
  /**
   * Wrapper around coursesList query to get courses for a given program
   */
  coursesForProgram: (program?: V2Program) => {
    const requirements = program?.requirements
    const courseIds = {
      required:
        requirements?.courses?.required
          ?.map((c) => c.id)
          .filter((id) => id !== undefined) ?? [],
      elective:
        requirements?.courses?.electives
          ?.map((c) => c.id)
          .filter((id) => id !== undefined) ?? [],
    }
    const allIds = [...courseIds.required, ...courseIds.elective]
    return queryOptions({
      ...coursesQueries.coursesList({ id: allIds, page_size: allIds.length }),
      enabled: allIds.length > 0,
    })
  },
}

export { coursesQueries, coursesKeys }
