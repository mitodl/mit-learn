import type {
  V2ProgramRequirement,
  V2ProgramRequirementData,
} from "@mitodl/mitxonline-api-axios/v2"
import { NodeTypeEnum } from "@mitodl/mitxonline-api-axios/v2"

import { faker } from "@faker-js/faker/locale/en"
import { UniqueEnforcer } from "enforce-unique"
import invariant from "tiny-invariant"

const uniqueNodeId = new UniqueEnforcer()
const uniqueProgramId = new UniqueEnforcer()

type NodeConstructorOpts = {
  id?: number | null
  data?: Partial<V2ProgramRequirementData>
}

/**
 * Build req_tree data for tests:
 *
 * ```ts
 * const root = new RequirementTreeBuilder()
 * const required = root.addOperator({ operator: "all_of" })
 * const elective = root.addOperator({ operator: "min_number_of", operator_value: "2" })
 *
 * required // Two required courses
 *   .addCourse()
 *   .addCourse()
 *
 * elective // Three elective courses, two of which must be completed
 *   .addCourse()
 *   .addCourse()
 *   .addCourse()
 *
 * const req_tree = root.serialize()
 * ```
 *
 */
class RequirementTreeBuilder implements V2ProgramRequirement {
  children: RequirementTreeBuilder[] | undefined
  data: V2ProgramRequirementData
  id: number
  #root: RequirementTreeBuilder

  constructor({ id, data }: NodeConstructorOpts = {}) {
    this.id = id ?? uniqueNodeId.enforce(faker.number.int)
    this.data = {
      // @ts-expect-error Root node is not actually exposed in the API
      node_type: "program_root",
      course: null,
      required_program: null,
      program: uniqueProgramId.enforce(faker.number.int),
      title: null,
      operator: null,
      operator_value: null,
      elective_flag: false,
      ...data,
    }
    this.#root = this
  }

  addChild(node: RequirementTreeBuilder) {
    node.#root = this.#root
    if (!this.children) {
      this.children = []
    }
    this.children.push(node)
  }

  addCourse({
    course,
  }: Pick<Partial<V2ProgramRequirement["data"]>, "course"> = {}) {
    const data: V2ProgramRequirementData = {
      node_type: NodeTypeEnum.Course,
      course: course ?? uniqueProgramId.enforce(faker.number.int),
      program: this.#root.data.program,
      required_program: null,
      title: null,
      operator: null,
      operator_value: null,
      elective_flag: false,
    }
    const courseNode = new RequirementTreeBuilder({ data })
    this.addChild(courseNode)
    return courseNode
  }
  addOperator(opts: {
    operator: "min_number_of" | "all_of"
    operator_value?: string
    title?: string
  }) {
    invariant(opts.operator, "operator is required")
    if (opts.operator === "min_number_of") {
      invariant(
        opts.operator_value &&
          !isNaN(Number(opts.operator_value)) &&
          Number(opts.operator_value) > 0,
        "operator_value is required and must be a positive number when operator is min_number_of",
      )
    }
    const data: V2ProgramRequirementData = {
      ...opts,
      node_type: NodeTypeEnum.Operator,
      course: null,
      required_program: null,
      program: this.#root.data.program,
      title: opts.title ?? faker.lorem.words(3),
      elective_flag: opts.operator === "min_number_of" ? true : false,
    }
    const operatorNode = new RequirementTreeBuilder({ data })
    this.addChild(operatorNode)
    return operatorNode
  }

  addProgram(opts: { program?: number; title?: string } = {}) {
    const programId = opts.program ?? uniqueProgramId.enforce(faker.number.int)
    const data: V2ProgramRequirementData = {
      node_type: NodeTypeEnum.Program,
      course: null,
      program: this.#root.data.program,
      required_program: programId,
      title: null,
      operator: null,
      operator_value: null,
      elective_flag: false,
    }
    const programNode = new RequirementTreeBuilder({ data })
    this.addChild(programNode)
    return programNode
  }

  #serialize(): V2ProgramRequirement {
    const node = { id: this.id, data: this.data }
    const children = this.children?.map((child) => child.#serialize())
    return children ? { ...node, children } : node
  }
  serialize(): V2ProgramRequirement[] {
    invariant(
      this.#root === this,
      "serialize can only be called on the root node",
    )
    return this.#serialize().children ?? []
  }
}

export { RequirementTreeBuilder }
