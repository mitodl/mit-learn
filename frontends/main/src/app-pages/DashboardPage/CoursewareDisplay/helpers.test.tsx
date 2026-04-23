import { factories } from "api/mitxonline-test-utils"
import {
  CourseRunEnrollmentV3,
  V2ProgramRequirement,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  EnrollmentStatus,
  filterEnrollmentsByOrganization,
  getBestRun,
  getRequirementsProgress,
  getProgramEnrollmentStatus,
  getKey,
  selectBestEnrollment,
  getEnrollmentStatus,
  ResourceType,
} from "./helpers"
import { allowConsoleErrors } from "ol-test-utilities"

describe("helpers", () => {
  describe("getKey", () => {
    test("generates key for course without run ID", () => {
      const key = getKey({
        resourceType: ResourceType.Course,
        id: 123,
      })
      expect(key).toBe("course-123")
    })

    test("generates key for course with run ID", () => {
      const key = getKey({
        resourceType: ResourceType.Course,
        id: 123,
        runId: 456,
      })
      expect(key).toBe("course-123-456")
    })

    test("generates key for program", () => {
      const key = getKey({
        resourceType: ResourceType.Program,
        id: 789,
      })
      expect(key).toBe("program-789")
    })
  })

  describe("filterEnrollmentsByOrganization", () => {
    test("filters enrollments by organization ID", () => {
      const orgId1 = 123
      const orgId2 = 456

      const enrollments = [
        {
          ...factories.enrollment.courseEnrollment(),
          b2b_contract_id: 1,
          b2b_organization_id: orgId1,
        },
        {
          ...factories.enrollment.courseEnrollment(),
          b2b_contract_id: 2,
          b2b_organization_id: orgId2,
        },
        {
          ...factories.enrollment.courseEnrollment(),
          b2b_contract_id: 3,
          b2b_organization_id: orgId1,
        },
        factories.enrollment.courseEnrollment(), // No org ID
      ]

      const filtered = filterEnrollmentsByOrganization(enrollments, orgId1)

      expect(filtered).toHaveLength(2)
      expect(filtered.every((e) => e.b2b_organization_id === orgId1)).toBe(true)
    })

    test("returns empty array when no enrollments match organization", () => {
      const enrollments = [
        {
          ...factories.enrollment.courseEnrollment(),
          b2b_contract_id: 1,
          b2b_organization_id: 123,
        },
        {
          ...factories.enrollment.courseEnrollment(),
          b2b_contract_id: 2,
          b2b_organization_id: 456,
        },
      ]

      const filtered = filterEnrollmentsByOrganization(enrollments, 999)

      expect(filtered).toHaveLength(0)
    })

    test("handles enrollments with null organization IDs", () => {
      const enrollments = [
        factories.enrollment.courseEnrollment(),
        {
          ...factories.enrollment.courseEnrollment(),
          b2b_contract_id: 1,
          b2b_organization_id: 123,
        },
      ]

      const filtered = filterEnrollmentsByOrganization(enrollments, 123)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].b2b_organization_id).toBe(123)
    })
  })

  describe("getBestRun", () => {
    test("returns undefined for course with no runs", () => {
      const course = factories.courses.course({
        courseruns: [],
        next_run_id: null,
      })
      const result = getBestRun(course)
      expect(result).toBeUndefined()
    })

    test("returns first run if no next_run_id specified", () => {
      const run1 = factories.courses.courseRun({
        id: 1,
        is_enrollable: true,
      })
      const run2 = factories.courses.courseRun({
        id: 2,
        is_enrollable: true,
      })
      const course = factories.courses.course({
        courseruns: [run1, run2],
        next_run_id: null,
      })

      const result = getBestRun(course)
      expect(result).toEqual(run1)
    })

    test("returns next_run_id run when specified", () => {
      const run1 = factories.courses.courseRun({
        id: 1,
        is_enrollable: true,
      })
      const run2 = factories.courses.courseRun({
        id: 2,
        is_enrollable: true,
      })
      const course = factories.courses.course({
        courseruns: [run1, run2],
        next_run_id: 2,
      })

      const result = getBestRun(course)
      expect(result).toEqual(run2)
    })

    test("filters by contract ID when provided", () => {
      const contractId = 100
      const run1 = factories.courses.courseRun({
        id: 1,
        b2b_contract: null,
        is_enrollable: true,
      })
      const run2 = factories.courses.courseRun({
        id: 2,
        b2b_contract: contractId,
        is_enrollable: true,
      })
      const run3 = factories.courses.courseRun({
        id: 3,
        b2b_contract: contractId,
        is_enrollable: true,
      })
      const course = factories.courses.course({
        courseruns: [run1, run2, run3],
        next_run_id: null,
      })

      const result = getBestRun(course, { contractId })
      expect(result).toEqual(run2)
    })

    test("prefers next_run_id within contract runs", () => {
      const contractId = 100
      const run1 = factories.courses.courseRun({
        id: 1,
        b2b_contract: contractId,
        is_enrollable: true,
      })
      const run2 = factories.courses.courseRun({
        id: 2,
        b2b_contract: contractId,
        is_enrollable: true,
      })
      const course = factories.courses.course({
        courseruns: [run1, run2],
        next_run_id: 2,
      })

      const result = getBestRun(course, { contractId })
      expect(result).toEqual(run2)
    })

    test("returns undefined if no runs match contract", () => {
      const run1 = factories.courses.courseRun({
        id: 1,
        b2b_contract: 200,
        is_enrollable: true,
      })
      const course = factories.courses.course({
        courseruns: [run1],
        next_run_id: null,
      })

      const result = getBestRun(course, { contractId: 100 })
      expect(result).toBeUndefined()
    })

    test("returns undefined when no runs are enrollable (enrollableOnly)", () => {
      const run1 = factories.courses.courseRun({
        id: 1,
        is_enrollable: false,
      })
      const run2 = factories.courses.courseRun({
        id: 2,
        is_enrollable: false,
      })
      const run3 = factories.courses.courseRun({
        id: 3,
        is_enrollable: false,
      })
      const course = factories.courses.course({
        courseruns: [run1, run2, run3],
        next_run_id: null,
      })

      const result = getBestRun(course, { enrollableOnly: true })
      expect(result).toBeUndefined()
    })

    test("skips unenrollable runs when enrollableOnly", () => {
      const run1 = factories.courses.courseRun({
        id: 1,
        is_enrollable: false,
      })
      const run2 = factories.courses.courseRun({
        id: 2,
        is_enrollable: true,
      })
      const course = factories.courses.course({
        courseruns: [run1, run2],
        next_run_id: null,
      })

      const result = getBestRun(course, { enrollableOnly: true })
      expect(result).toEqual(run2)
    })

    test("prefers enrollable runs when enrollableOnly", () => {
      const run1 = factories.courses.courseRun({
        id: 1,
        is_enrollable: true,
      })
      const run2 = factories.courses.courseRun({
        id: 2,
        is_enrollable: false,
      })
      const course = factories.courses.course({
        courseruns: [run1, run2],
        next_run_id: null,
      })

      const result = getBestRun(course, { enrollableOnly: true })
      expect(result).toEqual(run1)
    })
  })

  describe("selectBestEnrollment", () => {
    test("returns null when no enrollments match course", () => {
      const course = factories.courses.course({
        courseruns: [factories.courses.courseRun({ id: 1 })],
      })
      const enrollments = [
        factories.enrollment.courseEnrollment({
          run: { id: 999 },
        }),
      ]

      const result = selectBestEnrollment(course, enrollments)
      expect(result).toBeNull()
    })

    test("returns enrollment with certificate over one without", () => {
      const run = factories.courses.courseRun({ id: 1 })
      const course = factories.courses.course({ courseruns: [run] })

      const enrollmentNoCert = factories.enrollment.courseEnrollment({
        run: { id: 1 },
        certificate: null,
      })
      const enrollmentWithCert = factories.enrollment.courseEnrollment({
        run: { id: 1 },
        certificate: { uuid: "cert-123" },
      })

      const result = selectBestEnrollment(course, [
        enrollmentNoCert,
        enrollmentWithCert,
      ])
      expect(result).toEqual(enrollmentWithCert)
    })

    test("returns enrollment with higher grade when both have no certificate", () => {
      const run = factories.courses.courseRun({ id: 1 })
      const course = factories.courses.course({ courseruns: [run] })

      const enrollmentLowGrade = factories.enrollment.courseEnrollment({
        run: { id: 1 },
        certificate: null,
        grades: [factories.enrollment.grade({ grade: 0.5 })],
      })
      const enrollmentHighGrade = factories.enrollment.courseEnrollment({
        run: { id: 1 },
        certificate: null,
        grades: [factories.enrollment.grade({ grade: 0.9 })],
      })

      const result = selectBestEnrollment(course, [
        enrollmentLowGrade,
        enrollmentHighGrade,
      ])
      expect(result).toEqual(enrollmentHighGrade)
    })

    test("returns first enrollment when both have certificates and same grade", () => {
      const run = factories.courses.courseRun({ id: 1 })
      const course = factories.courses.course({ courseruns: [run] })

      const enrollment1 = factories.enrollment.courseEnrollment({
        run: { id: 1 },
        certificate: { uuid: "cert-1" },
        grades: [factories.enrollment.grade({ grade: 0.8 })],
      })
      const enrollment2 = factories.enrollment.courseEnrollment({
        run: { id: 1 },
        certificate: { uuid: "cert-2" },
        grades: [factories.enrollment.grade({ grade: 0.8 })],
      })

      const result = selectBestEnrollment(course, [enrollment1, enrollment2])
      expect(result).toEqual(enrollment1)
    })

    test("handles multiple course runs", () => {
      const run1 = factories.courses.courseRun({ id: 1 })
      const run2 = factories.courses.courseRun({ id: 2 })
      const course = factories.courses.course({ courseruns: [run1, run2] })

      const enrollmentRun1 = factories.enrollment.courseEnrollment({
        run: { id: 1 },
        grades: [factories.enrollment.grade({ grade: 0.7 })],
      })
      const enrollmentRun2 = factories.enrollment.courseEnrollment({
        run: { id: 2 },
        grades: [factories.enrollment.grade({ grade: 0.9 })],
      })

      const result = selectBestEnrollment(course, [
        enrollmentRun1,
        enrollmentRun2,
      ])
      expect(result).toEqual(enrollmentRun2) // Higher grade
    })
  })

  describe("getEnrollmentStatus", () => {
    test("returns NotEnrolled for null enrollment", () => {
      const status = getEnrollmentStatus(null)
      expect(status).toBe(EnrollmentStatus.NotEnrolled)
    })

    test("returns Completed when enrollment has passing grade", () => {
      const enrollment = factories.enrollment.courseEnrollment({
        grades: [factories.enrollment.grade({ passed: true })],
      })
      const status = getEnrollmentStatus(enrollment)
      expect(status).toBe(EnrollmentStatus.Completed)
    })

    test("returns Enrolled when enrollment has no passing grade", () => {
      const enrollment = factories.enrollment.courseEnrollment({
        grades: [factories.enrollment.grade({ passed: false })],
      })
      const status = getEnrollmentStatus(enrollment)
      expect(status).toBe(EnrollmentStatus.Enrolled)
    })

    test("returns Enrolled when enrollment has empty grades", () => {
      const enrollment = factories.enrollment.courseEnrollment({
        grades: [],
      })
      const status = getEnrollmentStatus(enrollment)
      expect(status).toBe(EnrollmentStatus.Enrolled)
    })

    test("returns Completed when any grade is passing", () => {
      const enrollment = factories.enrollment.courseEnrollment({
        grades: [
          factories.enrollment.grade({ passed: false }),
          factories.enrollment.grade({ passed: true }),
        ],
      })
      const status = getEnrollmentStatus(enrollment)
      expect(status).toBe(EnrollmentStatus.Completed)
    })
  })

  describe("getProgramEnrollmentStatus", () => {
    test("returns NotEnrolled when user has no program enrollment", () => {
      expect(getProgramEnrollmentStatus(undefined, 0, 0)).toBe(
        EnrollmentStatus.NotEnrolled,
      )
    })

    test("returns Completed when program certificate exists", () => {
      const programEnrollment = factories.enrollment.programEnrollmentV3({
        certificate: {
          uuid: "program-cert-1",
        },
      })

      expect(getProgramEnrollmentStatus(programEnrollment, 0, 0)).toBe(
        EnrollmentStatus.Completed,
      )
    })

    test("returns Enrolled when there are enrolled modules", () => {
      const programEnrollment = factories.enrollment.programEnrollmentV3({
        certificate: null,
      })

      expect(getProgramEnrollmentStatus(programEnrollment, 1, 0)).toBe(
        EnrollmentStatus.Enrolled,
      )
    })

    test("returns Enrolled when there are only completed modules", () => {
      const programEnrollment = factories.enrollment.programEnrollmentV3({
        certificate: null,
      })

      expect(getProgramEnrollmentStatus(programEnrollment, 0, 2)).toBe(
        EnrollmentStatus.Enrolled,
      )
    })
  })

  describe("getRequirementsProgress", () => {
    const courseLeaf = (id: number): V2ProgramRequirement => ({
      data: { node_type: "course", course: id }, // eslint-disable-line camelcase
    })

    const programLeaf = (id: number): V2ProgramRequirement => ({
      data: { node_type: "program", required_program: id }, // eslint-disable-line camelcase
    })

    const operator = (
      op: string,
      children: V2ProgramRequirement[],
      operatorValue: string | null = null,
    ): V2ProgramRequirement => ({
      data: {
        node_type: "operator",
        operator: op,
        operator_value: operatorValue, // eslint-disable-line camelcase
      },
      children,
    })

    const courseEnrollment = (
      courseId: number,
      passed: boolean,
    ): CourseRunEnrollmentV3 => {
      const run = factories.courses.courseRun({ id: courseId })
      const course = factories.courses.course({
        id: courseId,
        courseruns: [run],
      })
      return factories.enrollment.courseEnrollment({
        run: { ...run, course },
        grades: [factories.enrollment.grade({ passed })],
      })
    }

    test("all_of counts completed courses against total children", () => {
      const nodes = [operator("all_of", [courseLeaf(1), courseLeaf(2)])]
      const courseEnrollments = {
        1: [courseEnrollment(1, true)],
        2: [courseEnrollment(2, false)],
      }

      expect(getRequirementsProgress(nodes, courseEnrollments, {})).toEqual({
        completed: 1,
        total: 2,
      })
    })

    test("min_number_of caps completed and total at operator_value", () => {
      const nodes = [
        operator(
          "min_number_of",
          [courseLeaf(1), courseLeaf(2), courseLeaf(3)],
          "1",
        ),
      ]
      const courseEnrollments = {
        1: [courseEnrollment(1, true)],
        2: [courseEnrollment(2, true)],
        3: [courseEnrollment(3, true)],
      }

      expect(getRequirementsProgress(nodes, courseEnrollments, {})).toEqual({
        completed: 1,
        total: 1,
      })
    })

    test("sums progress across multiple top-level operators", () => {
      const nodes = [
        operator("all_of", [courseLeaf(1), courseLeaf(2)]),
        operator(
          "min_number_of",
          [courseLeaf(3), courseLeaf(4), courseLeaf(5)],
          "1",
        ),
      ]
      const courseEnrollments = {
        1: [courseEnrollment(1, true)],
        3: [courseEnrollment(3, true)],
        4: [courseEnrollment(4, true)],
      }

      expect(getRequirementsProgress(nodes, courseEnrollments, {})).toEqual({
        completed: 2,
        total: 3,
      })
    })

    test("program leaf is completed when enrollment has certificate", () => {
      const enrollments: Record<number, V3UserProgramEnrollment> = {
        10: factories.enrollment.programEnrollmentV3({
          certificate: { uuid: "cert-uuid" },
        }),
      }
      const nodes = [operator("all_of", [programLeaf(10), programLeaf(11)])]

      expect(getRequirementsProgress(nodes, {}, enrollments)).toEqual({
        completed: 1,
        total: 2,
      })
    })

    test("ignores non-operator and non-leaf children (nested operators)", () => {
      // Nested operators are not counted — only direct course/program children
      const nested = operator("all_of", [courseLeaf(99)])
      const nodes = [operator("all_of", [courseLeaf(1), nested])]

      const { consoleWarn } = allowConsoleErrors()
      expect(
        getRequirementsProgress(nodes, { 1: [courseEnrollment(1, true)] }, {}),
      ).toEqual({ completed: 1, total: 1 })
      expect(consoleWarn).toHaveBeenCalled()
    })

    test("min_number_of with operator_value=0 contributes nothing", () => {
      const nodes = [operator("min_number_of", [courseLeaf(1)], "0")]

      expect(
        getRequirementsProgress(nodes, { 1: [courseEnrollment(1, true)] }, {}),
      ).toEqual({ completed: 0, total: 0 })
    })

    test("min_number_of with malformed operator_value contributes nothing and warns", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
      const nodes = [operator("min_number_of", [courseLeaf(1)], "not-a-number")]

      expect(
        getRequirementsProgress(nodes, { 1: [courseEnrollment(1, true)] }, {}),
      ).toEqual({ completed: 0, total: 0 })
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })

    test("unknown operator contributes nothing and warns", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {})
      const nodes = [
        operator("at_least_one_of", [courseLeaf(1), courseLeaf(2)]),
      ]

      expect(
        getRequirementsProgress(nodes, { 1: [courseEnrollment(1, true)] }, {}),
      ).toEqual({ completed: 0, total: 0 })
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })

    test("empty nodes returns zeroes", () => {
      expect(getRequirementsProgress([], {}, {})).toEqual({
        completed: 0,
        total: 0,
      })
    })
  })
})
