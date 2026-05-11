import { factories } from "api/mitxonline-test-utils"
import {
  groupCourseRunEnrollmentsByCourseId,
  groupProgramEnrollmentsByProgramId,
  pickDisplayedEnrollmentForLegacyDashboard,
} from "./dashboardViewModel"

describe("dashboardViewModel", () => {
  describe("pickDisplayedEnrollmentForLegacyDashboard", () => {
    test("returns null when there are no matching course enrollments", () => {
      const course = factories.courses.course({
        courseruns: [factories.courses.courseRun({ id: 1 })],
      })
      const enrollments = [
        factories.enrollment.courseEnrollment({ run: { id: 999 } }),
      ]

      expect(
        pickDisplayedEnrollmentForLegacyDashboard(course, enrollments),
      ).toBeNull()
    })

    test("prefers enrollment with certificate over one without", () => {
      const run = factories.courses.courseRun({ id: 1 })
      const course = factories.courses.course({ courseruns: [run] })
      const noCertificate = factories.enrollment.courseEnrollment({
        run: { id: 1 },
        certificate: null,
      })
      const withCertificate = factories.enrollment.courseEnrollment({
        run: { id: 1 },
        certificate: { uuid: "cert-123" },
      })

      expect(
        pickDisplayedEnrollmentForLegacyDashboard(course, [
          noCertificate,
          withCertificate,
        ]),
      ).toEqual(withCertificate)
    })

    test("prefers highest grade when certificate state is tied", () => {
      const run = factories.courses.courseRun({ id: 1 })
      const course = factories.courses.course({ courseruns: [run] })
      const lower = factories.enrollment.courseEnrollment({
        run: { id: 1 },
        certificate: null,
        grades: [factories.enrollment.grade({ grade: 0.6 })],
      })
      const higher = factories.enrollment.courseEnrollment({
        run: { id: 1 },
        certificate: null,
        grades: [factories.enrollment.grade({ grade: 0.9 })],
      })

      expect(
        pickDisplayedEnrollmentForLegacyDashboard(course, [lower, higher]),
      ).toEqual(higher)
    })
  })

  describe("groupCourseRunEnrollmentsByCourseId", () => {
    test("groups enrollments by the course that owns their run", () => {
      const run1 = factories.courses.courseRun({ id: 11 })
      const run2 = factories.courses.courseRun({ id: 22 })
      const course1 = factories.courses.course({ id: 1, courseruns: [run1] })
      const course2 = factories.courses.course({ id: 2, courseruns: [run2] })

      const enrollment1 = factories.enrollment.courseEnrollment({
        run: { id: 11 },
      })
      const enrollment2 = factories.enrollment.courseEnrollment({
        run: { id: 22 },
      })
      const unknownRunEnrollment = factories.enrollment.courseEnrollment({
        run: { id: 999 },
      })

      const grouped = groupCourseRunEnrollmentsByCourseId(
        [course1, course2],
        [enrollment1, enrollment2, unknownRunEnrollment],
      )

      expect(grouped[1]).toEqual([enrollment1])
      expect(grouped[2]).toEqual([enrollment2])
      expect(grouped[999]).toBeUndefined()
    })
  })

  describe("groupProgramEnrollmentsByProgramId", () => {
    test("creates a map keyed by program id", () => {
      const enrollment1 = factories.enrollment.programEnrollmentV3({
        program: factories.programs.program({ id: 101 }),
      })
      const enrollment2 = factories.enrollment.programEnrollmentV3({
        program: factories.programs.program({ id: 202 }),
      })

      const grouped = groupProgramEnrollmentsByProgramId([
        enrollment1,
        enrollment2,
      ])

      expect(grouped[101]).toEqual(enrollment1)
      expect(grouped[202]).toEqual(enrollment2)
    })
  })
})
