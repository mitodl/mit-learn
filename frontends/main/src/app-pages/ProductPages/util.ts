import type { V2Program } from "@mitodl/mitxonline-api-axios/v2"
import { NodeTypeEnum } from "@mitodl/mitxonline-api-axios/v2"

enum HeadingIds {
  About = "about",
  What = "what-you-will-learn",
  How = "how-you-will-learn",
  Prereqs = "prerequisites",
  Instructors = "instructors",
  WhoCanTake = "who-can-take",
  Requirements = "requirements",
  Summary = "summary",
}

type RequirementData = {
  elective: boolean
  title: string
  courseIds: number[]
  requiredCourseCount: number
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

      const children = node.children ?? []
      if (!children.every((c) => c.data.node_type === NodeTypeEnum.Course)) {
        console.error(
          "UI Display expects program requirements operator nodes to only have course children",
        )
      }

      const courseIds =
        node.children
          ?.map((child) => child.data.course)
          .filter((id) => typeof id === "number") || []
      const requiredCourseCount =
        node.data.operator === "min_number_of"
          ? Number(node.data.operator_value) || courseIds.length
          : courseIds.length
      return {
        elective,
        title,
        courseIds,
        requiredCourseCount,
      }
    })
}

type ProductNoun = "Course" | "Program"

export { HeadingIds, parseReqTree }
export type { ProductNoun }
