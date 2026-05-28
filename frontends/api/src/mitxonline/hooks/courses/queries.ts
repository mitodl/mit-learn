import { queryOptions } from "@tanstack/react-query"
import type {
  CourseOutlineResponse as GeneratedCourseOutlineResponse,
  CoursesApiApiV2CoursesListRequest,
  CoursesApiCourseVariantRunsV3Request,
  CourseVariantRunsResponse,
  PaginatedCourseWithCourseRunsSerializerV2List,
} from "@mitodl/mitxonline-api-axios/v2"
import { coursesApi } from "../../clients"

type CourseOutlineResponse = GeneratedCourseOutlineResponse
type CourseOutlineModule = CourseOutlineResponse["modules"][number]
type CourseOutlineModuleCounts = CourseOutlineModule["counts"]

const coursesKeys = {
  root: ["mitxonline", "courses"],
  coursesList: (opts?: CoursesApiApiV2CoursesListRequest) => [
    ...coursesKeys.root,
    "list",
    opts,
  ],
  courseOutline: (coursewareId: string) => [
    ...coursesKeys.root,
    "outline",
    coursewareId,
  ],
  courseVariantRunsList: (opts: CoursesApiCourseVariantRunsV3Request) => [
    ...coursesKeys.root,
    "variant-runs",
    opts,
  ],
}

const coursesQueries = {
  coursesList: (opts?: CoursesApiApiV2CoursesListRequest) =>
    queryOptions({
      queryKey: coursesKeys.coursesList(opts),
      queryFn:
        async (): Promise<PaginatedCourseWithCourseRunsSerializerV2List> => {
          return coursesApi.apiV2CoursesList(opts).then((res) => res.data)
        },
    }),
  courseOutline: (coursewareId: string) =>
    queryOptions({
      queryKey: coursesKeys.courseOutline(coursewareId),
      queryFn: async (): Promise<CourseOutlineResponse> => {
        return coursesApi
          .courseOutlineRetrieveV3({ course_id: coursewareId })
          .then((res) => res.data)
      },
    }),
  courseVariantRunsList: (opts: CoursesApiCourseVariantRunsV3Request) =>
    queryOptions({
      queryKey: coursesKeys.courseVariantRunsList(opts),
      queryFn: async (): Promise<CourseVariantRunsResponse[]> => {
        return coursesApi.courseVariantRunsV3(opts).then((res) => res.data)
      },
    }),
}

export { coursesQueries, coursesKeys }
export type {
  CourseOutlineResponse,
  CourseOutlineModule,
  CourseOutlineModuleCounts,
  CourseVariantRunsResponse,
}
