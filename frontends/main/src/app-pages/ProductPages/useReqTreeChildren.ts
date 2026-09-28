import { useQuery } from "@tanstack/react-query"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { getIdsFromReqTree } from "@/common/mitxonline"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import type {
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"

type ReqTreeChildren = {
  courses?: CourseWithCourseRunsSerializerV2[]
  programs?: V2ProgramDetail[]
  isLoading: boolean
  /**
   * Whether every child program is presented as a course (display_mode
   * "course"), making a course count meaningful for the parent. False until
   * known: req_tree carries child ids but not their display_mode.
   */
  allChildrenAreCourseLike: boolean
}

/**
 * The queries useReqTreeChildren reads, so a server component can prefetch them
 * under the same keys.
 */
const reqTreeChildQueries = (program?: V2ProgramDetail) => {
  const { courseIds, programIds } = program
    ? getIdsFromReqTree(program.req_tree)
    : { courseIds: [], programIds: [] }
  return {
    courseIds,
    programIds,
    courses: coursesQueries.coursesList({
      id: courseIds,
      page_size: courseIds.length,
    }),
    programs: programsQueries.programsList({
      id: programIds,
      page_size: programIds.length,
    }),
  }
}

/**
 * Resolves the courses and programs referenced by a program's requirement tree.
 */
const useReqTreeChildren = (program?: V2ProgramDetail): ReqTreeChildren => {
  const queries = reqTreeChildQueries(program)
  const { courseIds, programIds } = queries

  const courses = useQuery({
    ...queries.courses,
    enabled: courseIds.length > 0,
  })

  const programs = useQuery({
    ...queries.programs,
    enabled: programIds.length > 0,
  })

  const childPrograms = programs.data?.results

  return {
    courses: courses.data?.results,
    programs: childPrograms,
    // Use skeletons as fallback for loading OR error
    isLoading:
      (courseIds.length > 0 && !courses.isSuccess) ||
      (programIds.length > 0 && !programs.isSuccess),
    allChildrenAreCourseLike:
      programIds.length === 0 ||
      (childPrograms !== undefined &&
        childPrograms.length > 0 &&
        childPrograms.every((p) => p.display_mode === DisplayModeEnum.Course)),
  }
}

export default useReqTreeChildren
export { reqTreeChildQueries }
