import { queryOptions } from "@tanstack/react-query"
import type {
  CoursesApiApiV2CoursesListRequest,
  PaginatedCourseWithCourseRunsSerializerV2List,
} from "@mitodl/mitxonline-api-axios/v2"
import type {
  CourseOutlineResponse as GeneratedCourseOutlineResponse,
  CoursesApiCourseVariantRunsV3Request,
  CourseVariantRunsResponse,
} from "@mitodl/mitxonline-api-axios/v3"
import { coursesApi, coursesV3Api } from "../../clients"

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
        return coursesV3Api
          .courseOutlineRetrieveV3({ course_id: coursewareId })
          .then((res) => res.data)
      },
    }),
  courseVariantRunsList: (opts: CoursesApiCourseVariantRunsV3Request) =>
    queryOptions({
      queryKey: coursesKeys.courseVariantRunsList(opts),
      queryFn: async (): Promise<CourseVariantRunsResponse[]> => {
        return coursesV3Api.courseVariantRunsV3(opts).then((res) => res.data)
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
