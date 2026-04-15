import { factories } from "api/mitxonline-test-utils"
import {
  CourseRunEnrollmentV3,
  V2ProgramRequirement,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  EnrollmentStatus,
  filterEnrollmentsByOrganization,
  getBestRun,
  getProgramCounts,
  getProgramEnrollmentStatus,
  getKey,
  isRequirementSectionItemCompleted,
  RequirementSection,
  selectBestEnrollment,
  getEnrollmentStatus,
  ResourceType,
} from "./helpers"

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

  describe("getProgramCounts", () => {
    const makeNode = (
      operator: string,
      operatorValue: string | null = null,
    ): V2ProgramRequirement => ({
      data: {
        node_type: "operator",
        operator,
        operator_value: operatorValue, // eslint-disable-line camelcase
      },
    })

    const passedGrade = factories.enrollment.grade({ passed: true })
    const failedGrade = factories.enrollment.grade({ passed: false })

    test("all_of section: counts all completed and total items", () => {
      const run1 = factories.courses.courseRun({ id: 1 })
      const run2 = factories.courses.courseRun({ id: 2 })
      const course1 = factories.courses.course({ id: 1, courseruns: [run1] })
      const course2 = factories.courses.course({ id: 2, courseruns: [run2] })

      const enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]> = {
        1: [
          factories.enrollment.courseEnrollment({
            run: { ...run1, course: course1 },
            grades: [passedGrade],
          }),
        ],
        2: [
          factories.enrollment.courseEnrollment({
            run: { ...run2, course: course2 },
            grades: [failedGrade],
          }),
        ],
      }

      const sections: RequirementSection[] = [
        {
          key: "s1",
          title: "Required",
          node: makeNode("all_of"),
          items: [
            { resourceType: "course", course: course1 },
            { resourceType: "course", course: course2 },
          ],
        },
      ]

      expect(getProgramCounts(sections, enrollmentsByCourseId)).toEqual({
        completed: 1,
        total: 2,
      })
    })

    test("min_number_of section: caps completions at operator_value", () => {
      const run3 = factories.courses.courseRun({ id: 3 })
      const run4 = factories.courses.courseRun({ id: 4 })
      const run5 = factories.courses.courseRun({ id: 5 })
      const course3 = factories.courses.course({ id: 3, courseruns: [run3] })
      const course4 = factories.courses.course({ id: 4, courseruns: [run4] })
      const course5 = factories.courses.course({ id: 5, courseruns: [run5] })

      // All 3 electives completed, but only 1 is required
      const enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]> = {
        3: [
          factories.enrollment.courseEnrollment({
            run: { ...run3, course: course3 },
            grades: [passedGrade],
          }),
        ],
        4: [
          factories.enrollment.courseEnrollment({
            run: { ...run4, course: course4 },
            grades: [passedGrade],
          }),
        ],
        5: [
          factories.enrollment.courseEnrollment({
            run: { ...run5, course: course5 },
            grades: [passedGrade],
          }),
        ],
      }

      const sections: RequirementSection[] = [
        {
          key: "s1",
          title: "Electives",
          node: makeNode("min_number_of", "1"),
          items: [
            { resourceType: "course", course: course3 },
            { resourceType: "course", course: course4 },
            { resourceType: "course", course: course5 },
          ],
        },
      ]

      expect(getProgramCounts(sections, enrollmentsByCourseId)).toEqual({
        completed: 1, // capped at operator_value=1, not 3
        total: 1,
      })
    })

    test("mixed sections: required all_of + optional min_number_of", () => {
      const run1 = factories.courses.courseRun({ id: 1 })
      const run2 = factories.courses.courseRun({ id: 2 })
      const run3 = factories.courses.courseRun({ id: 3 })
      const run4 = factories.courses.courseRun({ id: 4 })
      const run5 = factories.courses.courseRun({ id: 5 })
      const course1 = factories.courses.course({ id: 1, courseruns: [run1] })
      const course2 = factories.courses.course({ id: 2, courseruns: [run2] })
      const course3 = factories.courses.course({ id: 3, courseruns: [run3] })
      const course4 = factories.courses.course({ id: 4, courseruns: [run4] })
      const course5 = factories.courses.course({ id: 5, courseruns: [run5] })

      // Course 1 (required) completed + courses 3, 4 (electives) completed
      const enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]> = {
        1: [
          factories.enrollment.courseEnrollment({
            run: { ...run1, course: course1 },
            grades: [passedGrade],
          }),
        ],
        3: [
          factories.enrollment.courseEnrollment({
            run: { ...run3, course: course3 },
            grades: [passedGrade],
          }),
        ],
        4: [
          factories.enrollment.courseEnrollment({
            run: { ...run4, course: course4 },
            grades: [passedGrade],
          }),
        ],
      }

      const sections: RequirementSection[] = [
        {
          key: "required",
          title: "Required Courses",
          node: makeNode("all_of"),
          items: [
            { resourceType: "course", course: course1 },
            { resourceType: "course", course: course2 },
          ],
        },
        {
          key: "electives",
          title: "Electives",
          node: makeNode("min_number_of", "1"),
          items: [
            { resourceType: "course", course: course3 },
            { resourceType: "course", course: course4 },
            { resourceType: "course", course: course5 },
          ],
        },
      ]

      // completed: 1 required + min(2 electives, 1 required) = 2
      // total: 2 required + 1 elective min = 3
      expect(getProgramCounts(sections, enrollmentsByCourseId)).toEqual({
        completed: 2,
        total: 3,
      })
    })

    test("min_number_of with operator_value=0 contributes nothing to total or completed", () => {
      const run1 = factories.courses.courseRun({ id: 1 })
      const course1 = factories.courses.course({ id: 1, courseruns: [run1] })

      const enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]> = {
        1: [
          factories.enrollment.courseEnrollment({
            run: { ...run1, course: course1 },
            grades: [passedGrade],
          }),
        ],
      }

      const sections: RequirementSection[] = [
        {
          key: "s1",
          title: "Bonus",
          node: makeNode("min_number_of", "0"),
          items: [{ resourceType: "course", course: course1 }],
        },
      ]

      expect(getProgramCounts(sections, enrollmentsByCourseId)).toEqual({
        completed: 0,
        total: 0,
      })
    })

    test("program-enrollment items are excluded from both counts", () => {
      const programEnrollment = factories.enrollment.programEnrollmentV3({
        certificate: null,
      })

      const sections: RequirementSection[] = [
        {
          key: "s1",
          title: "Sub-programs",
          node: makeNode("all_of"),
          items: [
            {
              resourceType: "program-enrollment",
              enrollment: programEnrollment,
            },
          ],
        },
      ]

      expect(getProgramCounts(sections, {})).toEqual({
        completed: 0,
        total: 0,
      })
    })

    test("empty sections returns zeroes", () => {
      expect(getProgramCounts([], {})).toEqual({ completed: 0, total: 0 })
    })

    test("malformed operator_value falls back to counting all items", () => {
      const run1 = factories.courses.courseRun({ id: 1 })
      const course1 = factories.courses.course({ id: 1, courseruns: [run1] })
      const enrollmentsByCourseId: Record<number, CourseRunEnrollmentV3[]> = {
        1: [
          factories.enrollment.courseEnrollment({
            run: { ...run1, course: course1 },
            grades: [factories.enrollment.grade({ passed: true })],
          }),
        ],
      }

      const sections: RequirementSection[] = [
        {
          key: "s1",
          title: "Electives",
          node: makeNode("min_number_of", "not-a-number"),
          items: [{ resourceType: "course", course: course1 }],
        },
      ]

      expect(getProgramCounts(sections, enrollmentsByCourseId)).toEqual({
        completed: 1,
        total: 1,
      })
    })
  })

  describe("isRequirementSectionItemCompleted", () => {
    test("course item is completed when best enrollment has passing grade", () => {
      const run = factories.courses.courseRun({ id: 1 })
      const course = factories.courses.course({ id: 1, courseruns: [run] })
      const enrollment = factories.enrollment.courseEnrollment({
        run: { ...run, course },
        grades: [factories.enrollment.grade({ passed: true })],
      })

      const result = isRequirementSectionItemCompleted(
        { resourceType: "course", course },
        { 1: [enrollment] },
      )
      expect(result).toBe(true)
    })

    test("course item is not completed when no passing grade", () => {
      const run = factories.courses.courseRun({ id: 1 })
      const course = factories.courses.course({ id: 1, courseruns: [run] })
      const enrollment = factories.enrollment.courseEnrollment({
        run: { ...run, course },
        grades: [factories.enrollment.grade({ passed: false })],
      })

      const result = isRequirementSectionItemCompleted(
        { resourceType: "course", course },
        { 1: [enrollment] },
      )
      expect(result).toBe(false)
    })

    test("program-as-course item is completed when it has a certificate", () => {
      const program = factories.programs.program()
      const programEnrollment = factories.enrollment.programEnrollmentV3({
        certificate: { uuid: "cert-uuid" },
      })

      const result = isRequirementSectionItemCompleted(
        {
          resourceType: "program-as-course",
          courseProgramId: program.id,
          courseProgram: program,
          courseProgramEnrollment: programEnrollment,
        },
        {},
      )
      expect(result).toBe(true)
    })

    test("program-as-course item is not completed when enrollment has no certificate", () => {
      const program = factories.programs.program()
      const programEnrollment = factories.enrollment.programEnrollmentV3({
        certificate: null,
      })

      const result = isRequirementSectionItemCompleted(
        {
          resourceType: "program-as-course",
          courseProgramId: program.id,
          courseProgram: program,
          courseProgramEnrollment: programEnrollment,
        },
        {},
      )
      expect(result).toBe(false)
    })

    test("program-as-course item is not completed when enrollment is undefined", () => {
      const program = factories.programs.program()

      const result = isRequirementSectionItemCompleted(
        {
          resourceType: "program-as-course",
          courseProgramId: program.id,
          courseProgram: program,
          courseProgramEnrollment: undefined,
        },
        {},
      )
      expect(result).toBe(false)
    })

    test("program-enrollment item is never completed", () => {
      const programEnrollment = factories.enrollment.programEnrollmentV3({
        certificate: { uuid: "cert-uuid" },
      })

      const result = isRequirementSectionItemCompleted(
        { resourceType: "program-enrollment", enrollment: programEnrollment },
        {},
      )
      expect(result).toBe(false)
    })
  })
})
