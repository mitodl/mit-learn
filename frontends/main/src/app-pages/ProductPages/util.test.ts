import { parseReqTree, getOutlineCoursewareId } from "./util"
import { RequirementTreeBuilder, factories } from "api/mitxonline-test-utils"

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

describe("getOutlineCoursewareId", () => {
  test("uses next_run_id courseware_id when available", () => {
    const run1 = factories.courses.courseRun({
      id: 10,
      courseware_id: "course-v1:Org+A+Run1",
    })
    const run2 = factories.courses.courseRun({
      id: 20,
      courseware_id: "course-v1:Org+A+Run2",
    })
    const course = factories.courses.course({
      readable_id: "course-v1:Org+A",
      next_run_id: 20,
      courseruns: [run1, run2],
    })

    expect(getOutlineCoursewareId(course)).toBe("course-v1:Org+A+Run2")
  })

  test("falls back to first run courseware_id", () => {
    const course = factories.courses.course({
      readable_id: "course-v1:Org+A",
      next_run_id: null,
      courseruns: [
        factories.courses.courseRun({
          id: 1,
          courseware_id: "course-v1:Org+A+Run1",
        }),
      ],
    })

    expect(getOutlineCoursewareId(course)).toBe("course-v1:Org+A+Run1")
  })

  test("returns undefined when no run courseware_id exists", () => {
    const course = factories.courses.course({
      readable_id: "course-v1:Org+A",
      next_run_id: null,
      courseruns: [factories.courses.courseRun({ id: 1, courseware_id: "" })],
    })

    expect(getOutlineCoursewareId(course)).toBeUndefined()
  })
})
