import { parseReqTree, getRequirementItemNoun } from "./util"
import type { RequirementItem } from "./util"
import { RequirementTreeBuilder } from "api/mitxonline-test-utils"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"

describe("parseReqTree", () => {
  test("parses courses as requirement items", () => {
    const tree = new RequirementTreeBuilder()
    const op = tree.addOperator({ operator: "all_of" })
    const c1 = op.addCourse()
    const c2 = op.addCourse()

    const result = parseReqTree(tree.serialize())
    expect(result).toHaveLength(1)
    expect(result[0].items).toEqual([
      { type: "course", id: c1.data.course },
      { type: "course", id: c2.data.course },
    ])
    expect(result[0].requiredCount).toBe(2)
  })

  test("parses programs as requirement items", () => {
    const tree = new RequirementTreeBuilder()
    const op = tree.addOperator({ operator: "all_of" })
    const p1 = op.addProgram()

    const result = parseReqTree(tree.serialize())
    expect(result[0].items).toEqual([
      { type: "program", id: p1.data.required_program },
    ])
  })

  test("preserves interleaved order of courses and programs", () => {
    const tree = new RequirementTreeBuilder()
    const op = tree.addOperator({ operator: "all_of" })
    const c1 = op.addCourse()
    const p1 = op.addProgram()
    const c2 = op.addCourse()

    const result = parseReqTree(tree.serialize())
    expect(result[0].items).toEqual([
      { type: "course", id: c1.data.course },
      { type: "program", id: p1.data.required_program },
      { type: "course", id: c2.data.course },
    ])
  })

  test("counts items correctly with min_number_of operator", () => {
    const tree = new RequirementTreeBuilder()
    const op = tree.addOperator({
      operator: "min_number_of",
      operator_value: "2",
    })
    op.addCourse()
    op.addProgram()
    op.addCourse()

    const result = parseReqTree(tree.serialize())
    expect(result[0].requiredCount).toBe(2)
    expect(result[0].items).toHaveLength(3)
  })
})

describe("getRequirementItemNoun", () => {
  test("returns course singular/plural when all items are courses", () => {
    const items: RequirementItem[] = [
      { type: "course", id: 1 },
      { type: "course", id: 2 },
    ]
    expect(getRequirementItemNoun(items, {})).toEqual({
      singular: "course",
      plural: "courses",
    })
  })

  test("returns program singular/plural when all items are non-course-display programs", () => {
    const items: RequirementItem[] = [{ type: "program", id: 10 }]
    expect(
      getRequirementItemNoun(items, { 10: { display_mode: null } }),
    ).toEqual({
      singular: "program",
      plural: "programs",
    })
  })

  test("returns course singular/plural when program has display_mode=course", () => {
    const items: RequirementItem[] = [{ type: "program", id: 10 }]
    expect(
      getRequirementItemNoun(items, {
        10: { display_mode: DisplayModeEnum.Course },
      }),
    ).toEqual({ singular: "course", plural: "courses" })
  })

  test("returns courses/programs when mixed", () => {
    const items: RequirementItem[] = [
      { type: "course", id: 1 },
      { type: "program", id: 10 },
    ]
    expect(
      getRequirementItemNoun(items, { 10: { display_mode: null } }),
    ).toEqual({
      singular: "course/program",
      plural: "courses/programs",
    })
  })
})
