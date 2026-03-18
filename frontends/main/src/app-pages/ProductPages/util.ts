import type { V2Program } from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum, NodeTypeEnum } from "@mitodl/mitxonline-api-axios/v2"

enum HeadingIds {
  About = "about",
  What = "what-you-will-learn",
  How = "how-you-will-learn",
  Prereqs = "prerequisites",
  Instructors = "instructors",
  WhoCanTake = "who-can-take",
  Requirements = "requirements",
  Summary = "summary",
  Modules = "modules",
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
          ? Number(node.data.operator_value) || items.length
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

/**
 * Determine the noun to use for requirement items.
 * Programs with display_mode="course" count as courses.
 */
const getItemNoun = (
  items: RequirementItem[],
  programsById: Record<number, { display_mode?: string | null }>,
): { singular: string; plural: string } => {
  let hasCourse = false
  let hasProgram = false
  for (const item of items) {
    if (item.type === "course") {
      hasCourse = true
    } else {
      const prog = programsById[item.id]
      if (prog?.display_mode === DisplayModeEnum.Course) {
        hasCourse = true
      } else {
        hasProgram = true
      }
    }
  }
  if (hasCourse && hasProgram)
    return { singular: "course/program", plural: "courses/programs" }
  if (hasProgram) return { singular: "program", plural: "programs" }
  return { singular: "course", plural: "courses" }
}

type ProductNoun = "Course" | "Program"

export { HeadingIds, parseReqTree, getItemNoun }
export type { ProductNoun, RequirementData, RequirementItem }
