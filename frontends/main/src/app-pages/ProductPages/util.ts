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
}

const getElectiveSubtree = (
  program: V2Program,
): V2ProgramRequirement | undefined => {
  const find = (
    nodes: V2ProgramRequirement[],
  ): V2ProgramRequirement | undefined =>
    nodes?.find(
      (child) =>
        child.data.node_type ===
          V2ProgramRequirementDataNodeTypeEnum.Operator &&
        child.data.elective_flag,
    )
  return find(program.req_tree) ?? find(program.req_tree[0]?.children || [])
}
const getRequiredSubtree = (
  program: V2Program,
): V2ProgramRequirement | undefined => {
  const find = (
    nodes: V2ProgramRequirement[],
  ): V2ProgramRequirement | undefined =>
    nodes?.find(
      (child) =>
        child.data.node_type ===
          V2ProgramRequirementDataNodeTypeEnum.Operator &&
        !child.data.elective_flag,
    )
  return find(program.req_tree) ?? find(program.req_tree[0]?.children || [])
}

export { HeadingIds, getElectiveSubtree, getRequiredSubtree }
