import { factories } from "api/mitxonline-test-utils"
import type { CourseRunEnrollmentV3 } from "@mitodl/mitxonline-api-axios/v2"
import {
  getDashboardLanguageOptions,
  getDistinctDashboardLanguageOptions,
  groupCourseRunEnrollmentsByCourseId,
  groupProgramEnrollmentsByProgramId,
  pickDisplayedEnrollmentForLegacyDashboard,
  resolveSlotForLanguage,
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

  describe("getDashboardLanguageOptions", () => {
    test("includes enrollment language not present in enrollable language options", () => {
      const englishRun = factories.courses.courseRun({
        id: 101,
        language: "en",
        courseware_id: "cw-en-101",
        courseware_url: "https://example.com/en-101",
        is_enrollable: true,
      })

      const course = factories.courses.course({
        id: 1,
        courseruns: [englishRun],
        next_run_id: englishRun.id,
        language_options: [
          {
            id: englishRun.id,
            courseware_id: englishRun.courseware_id,
            courseware_url: englishRun.courseware_url ?? "",
            language: "en",
            title: englishRun.title,
            run_tag: englishRun.run_tag,
          },
        ],
      })

      const spanishEnrollment = factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
        run: {
          id: 999,
          language: "es",
          title: "Modulo Espanol",
          run_tag: "ES-1",
          course: { id: course.id, title: course.title },
          courseware_id: "cw-es-999",
          courseware_url: "https://example.com/es-999",
          is_enrollable: false,
          is_upgradable: false,
          is_archived: false,
          is_self_paced: true,
          start_date: null,
          end_date: null,
          upgrade_deadline: null,
          certificate_available_date: null,
          course_number: "",
        },
      })

      const options = getDashboardLanguageOptions(course, [spanishEnrollment])

      expect(options.map((option) => option.value)).toEqual([
        "language:en",
        "language:es",
      ])
    })

    test("adds only relevant enrollment languages for the provided course set", () => {
      const courseA = factories.courses.course({ id: 10, language_options: [] })
      const courseB = factories.courses.course({ id: 20, language_options: [] })

      const enrollmentA = factories.enrollment.courseEnrollment({
        run: {
          id: 1,
          language: "fr",
          title: "Run FR",
          run_tag: "FR-1",
          course: { id: 10, title: "Course A" },
          courseware_id: "cw-fr-1",
          courseware_url: "https://example.com/fr-1",
          is_enrollable: true,
          is_upgradable: false,
          is_archived: false,
          is_self_paced: true,
          start_date: null,
          end_date: null,
          upgrade_deadline: null,
          certificate_available_date: null,
          course_number: "",
        },
      })
      const enrollmentOtherCourse = factories.enrollment.courseEnrollment({
        run: {
          id: 2,
          language: "de",
          title: "Run DE",
          run_tag: "DE-1",
          course: { id: 999, title: "Outside" },
          courseware_id: "cw-de-2",
          courseware_url: "https://example.com/de-2",
          is_enrollable: true,
          is_upgradable: false,
          is_archived: false,
          is_self_paced: true,
          start_date: null,
          end_date: null,
          upgrade_deadline: null,
          certificate_available_date: null,
          course_number: "",
        },
      })

      const options = getDistinctDashboardLanguageOptions(
        [courseA, courseB],
        [enrollmentA, enrollmentOtherCourse],
      )

      expect(options.map((option) => option.value)).toEqual(["language:fr"])
    })

    test("skips enrollments with missing runs", () => {
      const course = factories.courses.course({ id: 30, language_options: [] })
      const missingRunEnrollment = {
        run: undefined,
      } as unknown as CourseRunEnrollmentV3

      const options = getDistinctDashboardLanguageOptions(
        [course],
        [missingRunEnrollment],
      )

      expect(options).toEqual([])
    })

    test("uses the shared native language fallback label for enrollment-derived options", () => {
      const originalDisplayNames = Intl.DisplayNames
      Object.defineProperty(Intl, "DisplayNames", {
        value: undefined,
        configurable: true,
        writable: true,
      })

      try {
        const course = factories.courses.course({
          id: 40,
          language_options: [],
          courseruns: [],
        })
        const enrollment = factories.enrollment.courseEnrollment({
          run: {
            id: 400,
            language: "es",
            title: "Spanish Run",
            run_tag: "ES-1",
            course: { id: 40, title: course.title },
            courseware_id: "cw-es-400",
            courseware_url: "https://example.com/es-400",
            is_enrollable: true,
            is_upgradable: false,
            is_archived: false,
            is_self_paced: true,
            start_date: null,
            end_date: null,
            upgrade_deadline: null,
            certificate_available_date: null,
            course_number: "",
          },
        })

        const options = getDistinctDashboardLanguageOptions(
          [course],
          [enrollment],
        )

        expect(options).toEqual([
          {
            value: "language:es",
            label: "español",
          },
        ])
      } finally {
        Object.defineProperty(Intl, "DisplayNames", {
          value: originalDisplayNames,
          configurable: true,
          writable: true,
        })
      }
    })
  })

  describe("resolveSlotForLanguage", () => {
    test("prefers selected-language enrollment", () => {
      const englishRun = factories.courses.courseRun({
        id: 11,
        language: "en",
        courseware_id: "cw-en-11",
        courseware_url: "https://example.com/en-11",
        is_enrollable: true,
      })
      const spanishRun = factories.courses.courseRun({
        id: 12,
        language: "es",
        courseware_id: "cw-es-12",
        courseware_url: "https://example.com/es-12",
        is_enrollable: true,
      })
      const course = factories.courses.course({
        id: 1,
        courseruns: [englishRun, spanishRun],
        next_run_id: englishRun.id,
        language_options: [
          {
            id: englishRun.id,
            courseware_id: englishRun.courseware_id,
            courseware_url: englishRun.courseware_url ?? "",
            language: "en",
            title: englishRun.title,
            run_tag: englishRun.run_tag,
          },
          {
            id: spanishRun.id,
            courseware_id: spanishRun.courseware_id,
            courseware_url: spanishRun.courseware_url ?? "",
            language: "es",
            title: spanishRun.title,
            run_tag: spanishRun.run_tag,
          },
        ],
      })

      const englishEnrollment = factories.enrollment.courseEnrollment({
        run: {
          id: englishRun.id,
          language: "en",
          course: { id: course.id, title: course.title },
          title: englishRun.title,
          run_tag: englishRun.run_tag,
          courseware_id: englishRun.courseware_id,
          courseware_url: englishRun.courseware_url,
          is_enrollable: englishRun.is_enrollable,
          is_upgradable: englishRun.is_upgradable,
          is_archived: englishRun.is_archived,
          is_self_paced: englishRun.is_self_paced,
          start_date: englishRun.start_date,
          end_date: englishRun.end_date,
          upgrade_deadline: englishRun.upgrade_deadline,
          certificate_available_date: englishRun.certificate_available_date,
          course_number: englishRun.course_number,
        },
      })
      const spanishEnrollment = factories.enrollment.courseEnrollment({
        run: {
          id: spanishRun.id,
          language: "es",
          course: { id: course.id, title: course.title },
          title: spanishRun.title,
          run_tag: spanishRun.run_tag,
          courseware_id: spanishRun.courseware_id,
          courseware_url: spanishRun.courseware_url,
          is_enrollable: spanishRun.is_enrollable,
          is_upgradable: spanishRun.is_upgradable,
          is_archived: spanishRun.is_archived,
          is_self_paced: spanishRun.is_self_paced,
          start_date: spanishRun.start_date,
          end_date: spanishRun.end_date,
          upgrade_deadline: spanishRun.upgrade_deadline,
          certificate_available_date: spanishRun.certificate_available_date,
          course_number: spanishRun.course_number,
        },
      })

      const resolved = resolveSlotForLanguage(
        course,
        [englishEnrollment, spanishEnrollment],
        "language:es",
      )

      expect(resolved.displayedEnrollment?.run.id).toBe(spanishRun.id)
      expect(resolved.displayedRun?.id).toBe(spanishRun.id)
    })

    test("does not pick enrollment from another contract", () => {
      const englishRun = factories.courses.courseRun({
        id: 21,
        b2b_contract: 1,
        courseware_id: "cw-en-21",
        courseware_url: "https://example.com/en-21",
        is_enrollable: true,
      })
      const spanishRun = factories.courses.courseRun({
        id: 22,
        b2b_contract: 2,
        courseware_id: "cw-es-22",
        courseware_url: "https://example.com/es-22",
        is_enrollable: true,
      })
      const course = factories.courses.course({
        id: 2,
        courseruns: [englishRun, spanishRun],
        next_run_id: englishRun.id,
        language_options: [
          {
            id: englishRun.id,
            courseware_id: englishRun.courseware_id,
            courseware_url: englishRun.courseware_url ?? "",
            language: "en",
            title: englishRun.title,
            run_tag: englishRun.run_tag,
          },
          {
            id: spanishRun.id,
            courseware_id: spanishRun.courseware_id,
            courseware_url: spanishRun.courseware_url ?? "",
            language: "es",
            title: spanishRun.title,
            run_tag: spanishRun.run_tag,
          },
        ],
      })

      const otherContractEnrollment = factories.enrollment.courseEnrollment({
        b2b_contract_id: 2,
        run: {
          id: spanishRun.id,
          language: "es",
          course: { id: course.id, title: course.title },
          title: spanishRun.title,
          run_tag: spanishRun.run_tag,
          courseware_id: spanishRun.courseware_id,
          courseware_url: spanishRun.courseware_url,
          is_enrollable: spanishRun.is_enrollable,
          is_upgradable: spanishRun.is_upgradable,
          is_archived: spanishRun.is_archived,
          is_self_paced: spanishRun.is_self_paced,
          start_date: spanishRun.start_date,
          end_date: spanishRun.end_date,
          upgrade_deadline: spanishRun.upgrade_deadline,
          certificate_available_date: spanishRun.certificate_available_date,
          course_number: spanishRun.course_number,
        },
      })

      const resolved = resolveSlotForLanguage(
        course,
        [otherContractEnrollment],
        "language:es",
        { contractId: 1 },
      )

      expect(resolved.displayedEnrollment).toBeNull()
    })

    test("keeps fallback synthesized run for unenrolled selected language", () => {
      const templateRun = factories.courses.courseRun({
        id: 31,
        b2b_contract: 1,
        courseware_id: "cw-en-31",
        courseware_url: "https://example.com/en-31",
        is_enrollable: true,
      })
      const course = factories.courses.course({
        id: 3,
        courseruns: [templateRun],
        next_run_id: templateRun.id,
        language_options: [
          {
            id: templateRun.id,
            courseware_id: templateRun.courseware_id,
            courseware_url: templateRun.courseware_url ?? "",
            language: "en",
            title: templateRun.title,
            run_tag: templateRun.run_tag,
          },
          {
            id: 32,
            courseware_id: "cw-es-32",
            courseware_url: "https://example.com/es-32",
            language: "es",
            title: "Modulo Espanol",
            run_tag: "ES-32",
          },
        ],
      })

      const resolved = resolveSlotForLanguage(course, [], "language:es", {
        contractId: 1,
      })

      expect(resolved.displayedEnrollment).toBeNull()
      expect(resolved.displayedRun?.id).toBe(32)
      expect(resolved.displayedRun?.courseware_id).toBe("cw-es-32")
    })
  })
})
