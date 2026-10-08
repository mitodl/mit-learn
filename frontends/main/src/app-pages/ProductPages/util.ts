import {
  NodeTypeEnum,
  type CourseWithCourseRunsSerializerV2,
  type V2Program,
  type V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { parseTrackedProgramRequirements } from "@/common/mitxonline"

enum HeadingIds {
  About = "about",
  What = "what-you-will-learn",
  CourseContent = "course-content",
  How = "how-you-will-learn",
  Prereqs = "prerequisites",
  Instructors = "instructors",
  Requirements = "requirements",
  Summary = "summary",
  Modules = "modules",
  Testimonials = "testimonials",
  Faqs = "faqs",
  TrackCompare = "compare-tracks",
}

type RequirementItem =
  | { type: "course"; id: number }
  | { type: "program"; id: number }

type RequirementData = {
  id?: number | null // In practice this should always be defined. TODO: Why doesn't OpenAPI know this?
  elective: boolean
  title: string
  items: RequirementItem[]
  requiredCount: number
}

const parseReqTree = (reqTree: V2Program["req_tree"]): RequirementData[] => {
  if (!reqTree.every((node) => node.data.node_type === NodeTypeEnum.Operator)) {
    console.error(
      "UI Display expects program requirements root to only have operator children",
    )
  }

  return reqTree
    .filter((node) => node.data.node_type === NodeTypeEnum.Operator)
    .map((node) => {
      const elective = node.data.elective_flag ?? false
      const title =
        node.data.title || (elective ? "Elective Courses" : "Core Courses")

      const items: RequirementItem[] = (node.children ?? []).flatMap(
        (child): RequirementItem[] => {
          if (
            child.data.node_type === NodeTypeEnum.Course &&
            typeof child.data.course === "number"
          ) {
            return [{ type: "course", id: child.data.course }]
          }
          if (
            child.data.node_type === NodeTypeEnum.Program &&
            typeof child.data.required_program === "number"
          ) {
            return [{ type: "program", id: child.data.required_program }]
          }
          return []
        },
      )

      const requiredCount =
        node.data.operator === "min_number_of"
          ? Number(node.data.operator_value)
          : items.length
      return {
        id: node.id,
        elective,
        title,
        items,
        requiredCount,
      }
    })
}

const getRequirementSectionSubtitle = (
  reqData: Pick<RequirementData, "requiredCount" | "items">,
) => {
  if (reqData.requiredCount === 0 && reqData.items.length > 0) {
    return null
  }
  if (reqData.requiredCount < reqData.items.length) {
    return `Complete ${reqData.requiredCount} out of ${reqData.items.length}`
  }
  return null
}

/**
 * e.g. "Complete 2 of 3 courses." for a track group that is a choice.
 *
 * DEDP's design adds "At least 1 must be advanced." and tags each course
 * Introductory or Advanced. The API has no course level or advanced-course
 * rule yet (mitxonline#4093 leaves it out), so only the count is shown.
 */
const getTrackGroupRuleText = (
  section: Pick<RequirementData, "requiredCount" | "items">,
) => {
  if (section.requiredCount >= section.items.length) return null
  return `Complete ${section.requiredCount} of ${section.items.length} courses.`
}

const getTotalRequiredCourses = (program: V2ProgramDetail) => {
  const tracked = parseTrackedProgramRequirements(program.req_tree)
  if (!tracked) {
    const parsedReqs = parseReqTree(program.req_tree)
    return parsedReqs.reduce((sum, req) => sum + req.requiredCount, 0)
  }
  const sumRequired = (sections: { requiredCount: number }[]) =>
    sections.reduce((sum, section) => sum + section.requiredCount, 0)
  // A learner completes the groups outside the tracks plus one track. When
  // tracks require different numbers of courses this reports the smallest;
  // product hasn't decided how to present a range yet.
  const fewestTrackCourses = Math.min(
    ...tracked.tracks.map((track) => sumRequired(track.sections)),
  )
  return (
    sumRequired(tracked.sectionsBeforeTracks) +
    fewestTrackCourses +
    sumRequired(tracked.sectionsAfterTracks)
  )
}

const getOutlineCoursewareId = (
  course: CourseWithCourseRunsSerializerV2,
): string | undefined => {
  const runs = course.courseruns ?? []
  const nextRun = runs.find((run) => run.id === course.next_run_id)
  if (nextRun?.courseware_id) {
    return nextRun.courseware_id
  }

  const firstRunWithCoursewareId = runs.find((run) =>
    Boolean(run.courseware_id),
  )
  if (firstRunWithCoursewareId?.courseware_id) {
    return firstRunWithCoursewareId.courseware_id
  }
  return undefined
}

type ProductNoun = "Course" | "Program"

export {
  HeadingIds,
  parseReqTree,
  getRequirementSectionSubtitle,
  getTrackGroupRuleText,
  getTotalRequiredCourses,
  getOutlineCoursewareId,
}
export type { ProductNoun, RequirementData, RequirementItem }
