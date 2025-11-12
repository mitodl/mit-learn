import type {
  V2Program,
  V2ProgramRequirement,
} from "@mitodl/mitxonline-api-axios/v2"
import { V2ProgramRequirementDataNodeTypeEnum } from "@mitodl/mitxonline-api-axios/v2"

enum HeadingIds {
  About = "about",
  What = "what-you-will-learn",
  Prereqs = "prerequisites",
  Instructors = "instructors",
  WhoCanTake = "who-can-take",
  Requirements = "requirements",
  RequirementsRequired = "required-courses",
  RequirementsElectives = "elective-courses",
}

const getSubtree = (program: V2Program, type: "required" | "elective") => {
  const find = (
    nodes: V2ProgramRequirement[],
  ): V2ProgramRequirement | undefined =>
    nodes?.find(
      (child) =>
        child.data.node_type ===
          V2ProgramRequirementDataNodeTypeEnum.Operator &&
        (type === "elective"
          ? child.data.elective_flag
          : !child.data.elective_flag),
    )
  return find(program.req_tree) ?? find(program.req_tree[0]?.children || [])
}

export { HeadingIds, getSubtree }
