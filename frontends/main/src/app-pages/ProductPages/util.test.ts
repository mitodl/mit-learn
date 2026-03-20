import { parseReqTree } from "./util"
import { RequirementTreeBuilder } from "api/mitxonline-test-utils"

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
