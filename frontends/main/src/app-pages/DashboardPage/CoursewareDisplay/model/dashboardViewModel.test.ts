import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { factories } from "api/mitxonline-test-utils"
import {
  bucketAndSortHomeEnrollments,
  enrollmentCourseIsInPrograms,
  getDistinctDashboardLanguageOptions,
  getModuleCourseIdsFromPrograms,
  getNonContractProgramEnrollments,
  getTopLevelProgramEnrollments,
  groupCourseRunEnrollmentsByCourseId,
  groupModuleCoursesByProgramId,
  groupProgramEnrollmentsByProgramId,
  isNonContractEnrollment,
  isProgramAsCourse,
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
    test("groups enrollments by their run's course id", () => {
      const enrollmentA1 = factories.enrollment.courseEnrollment({
        run: { course: { id: 1 } },
      })
      const enrollmentA2 = factories.enrollment.courseEnrollment({
        run: { course: { id: 1 } },
      })
      const enrollmentB = factories.enrollment.courseEnrollment({
        run: { course: { id: 2 } },
      })

      const grouped = groupCourseRunEnrollmentsByCourseId([
        enrollmentA1,
        enrollmentA2,
        enrollmentB,
      ])

      expect(grouped[1]).toEqual([enrollmentA1, enrollmentA2])
      expect(grouped[2]).toEqual([enrollmentB])
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

  describe("isProgramAsCourse", () => {
    test("matches programs whose display_mode is Course", () => {
      const courseProgram = factories.programs.program({
        display_mode: DisplayModeEnum.Course,
      })
      const regularProgram = factories.programs.program({ display_mode: null })
      expect(isProgramAsCourse(courseProgram)).toBe(true)
      expect(isProgramAsCourse(regularProgram)).toBe(false)
    })
  })

  describe("isNonContractEnrollment", () => {
    test("matches enrollments with no b2b_contract_id", () => {
      const nonContract = factories.enrollment.courseEnrollment({
        b2b_contract_id: null,
      })
      const contract = factories.enrollment.courseEnrollment({
        b2b_contract_id: 42,
      })
      expect(isNonContractEnrollment(nonContract)).toBe(true)
      expect(isNonContractEnrollment(contract)).toBe(false)
    })
  })

  describe("enrollmentCourseIsInPrograms", () => {
    test("returns predicate matching enrollments whose course id appears in any program", () => {
      const programA = factories.programs.program({ courses: [10, 11] })
      const programB = factories.programs.program({ courses: [20] })
      const inA = factories.enrollment.courseEnrollment({
        run: { course: { id: 10 } },
      })
      const inB = factories.enrollment.courseEnrollment({
        run: { course: { id: 20 } },
      })
      const outside = factories.enrollment.courseEnrollment({
        run: { course: { id: 99 } },
      })

      const isCovered = enrollmentCourseIsInPrograms([programA, programB])
      expect([inA, inB, outside].filter(isCovered)).toEqual([inA, inB])
    })
  })

  describe("getNonContractProgramEnrollments", () => {
    test("excludes program enrollments whose program is in any contract", () => {
      const inContract = factories.enrollment.programEnrollmentV3({
        program: factories.programs.program({ id: 1 }),
      })
      const standalone = factories.enrollment.programEnrollmentV3({
        program: factories.programs.program({ id: 2 }),
      })
      const contracts = [factories.contracts.contract({ programs: [1] })]

      expect(
        getNonContractProgramEnrollments([inContract, standalone], contracts),
      ).toEqual([standalone])
    })
  })

  describe("getTopLevelProgramEnrollments", () => {
    test("excludes program enrollments whose program is a child in another program's req_tree", () => {
      const childProgram = factories.programs.program({ id: 50 })
      const parentProgram = factories.programs.program({
        id: 51,
        req_tree: [
          {
            id: 1,
            data: {
              node_type: "operator",
              operator: "all_of",
              operator_value: null,
              elective_flag: false,
              title: null,
              course: null,
              required_program: null,
            },
            children: [
              {
                id: 2,
                data: {
                  node_type: "program",
                  required_program: childProgram.id,
                  operator: null,
                  operator_value: null,
                  elective_flag: false,
                  title: null,
                  course: null,
                },
                children: [],
              },
            ],
          },
        ],
      })
      const childEnrollment = factories.enrollment.programEnrollmentV3({
        program: childProgram,
      })
      const parentEnrollment = factories.enrollment.programEnrollmentV3({
        program: parentProgram,
      })

      expect(
        getTopLevelProgramEnrollments(
          [childEnrollment, parentEnrollment],
          [parentProgram],
        ),
      ).toEqual([parentEnrollment])
    })
  })

  describe("getModuleCourseIdsFromPrograms", () => {
    test("returns the distinct set of course ids referenced anywhere in the programs' req_trees", () => {
      const program = factories.programs.program({
        req_tree: [
          {
            id: 1,
            data: {
              node_type: "operator",
              operator: "all_of",
              operator_value: null,
              elective_flag: false,
              title: null,
              course: null,
              required_program: null,
            },
            children: [
              {
                id: 2,
                data: {
                  node_type: "course",
                  course: 100,
                  operator: null,
                  operator_value: null,
                  elective_flag: false,
                  title: null,
                  required_program: null,
                },
                children: [],
              },
              {
                id: 3,
                data: {
                  node_type: "course",
                  course: 200,
                  operator: null,
                  operator_value: null,
                  elective_flag: false,
                  title: null,
                  required_program: null,
                },
                children: [],
              },
              {
                id: 4,
                data: {
                  node_type: "course",
                  course: 100,
                  operator: null,
                  operator_value: null,
                  elective_flag: false,
                  title: null,
                  required_program: null,
                },
                children: [],
              },
            ],
          },
        ],
      })

      expect(getModuleCourseIdsFromPrograms([program]).sort()).toEqual([
        100, 200,
      ])
    })

    test("dedupes course ids across multiple programs", () => {
      const makeCourseLeaf = (id: number, courseId: number) => ({
        id,
        data: {
          node_type: "course" as const,
          course: courseId,
          operator: null,
          operator_value: null,
          elective_flag: false,
          title: null,
          required_program: null,
        },
        children: [],
      })
      const makeProgram = (programId: number, courseIds: number[]) =>
        factories.programs.program({
          id: programId,
          req_tree: [
            {
              id: programId * 10,
              data: {
                node_type: "operator",
                operator: "all_of",
                operator_value: null,
                elective_flag: false,
                title: null,
                course: null,
                required_program: null,
              },
              children: courseIds.map((c) => makeCourseLeaf(c + programId, c)),
            },
          ],
        })

      const programA = makeProgram(1, [100, 200])
      const programB = makeProgram(2, [200, 300])

      expect(
        getModuleCourseIdsFromPrograms([programA, programB]).sort(),
      ).toEqual([100, 200, 300])
    })
  })

  describe("groupModuleCoursesByProgramId", () => {
    test("indexes courses by the program whose courses[] lists them", () => {
      const programA = factories.programs.program({ id: 1, courses: [10, 11] })
      const programB = factories.programs.program({ id: 2, courses: [20] })
      const course10 = factories.courses.course({ id: 10 })
      const course11 = factories.courses.course({ id: 11 })
      const course20 = factories.courses.course({ id: 20 })
      const courseUnreferenced = factories.courses.course({ id: 99 })

      const grouped = groupModuleCoursesByProgramId(
        [programA, programB],
        [course10, course11, course20, courseUnreferenced],
      )

      expect(grouped[1]).toEqual([course10, course11])
      expect(grouped[2]).toEqual([course20])
    })

    test("maps program with empty courses[] to an empty array", () => {
      const program = factories.programs.program({ id: 1, courses: [] })
      const course = factories.courses.course({ id: 10 })
      expect(groupModuleCoursesByProgramId([program], [course])).toEqual({
        1: [],
      })
    })
  })

  describe("bucketAndSortHomeEnrollments", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()

    test("buckets enrollments by status and sorts each bucket", () => {
      const completedEnrollment = factories.enrollment.courseEnrollment({
        grades: [factories.enrollment.grade({ grade: 0.9, passed: true })],
        run: { course: { title: "Zeta" } },
      })
      const expiredEnrollment = factories.enrollment.courseEnrollment({
        run: { start_date: past, end_date: past, course: { title: "Alpha" } },
      })
      const startedAlpha = factories.enrollment.courseEnrollment({
        run: { start_date: past, end_date: future, course: { title: "Alpha" } },
      })
      const startedBeta = factories.enrollment.courseEnrollment({
        run: { start_date: past, end_date: future, course: { title: "Beta" } },
      })
      const notStartedSooner = factories.enrollment.courseEnrollment({
        run: {
          start_date: future,
          end_date: null,
          course: { title: "Late" },
        },
      })
      const notStartedLater = factories.enrollment.courseEnrollment({
        run: {
          start_date: new Date(
            Date.now() + 1000 * 60 * 60 * 24 * 7,
          ).toISOString(),
          end_date: null,
          course: { title: "Earlier-by-title-but-later-by-date" },
        },
      })

      const buckets = bucketAndSortHomeEnrollments([
        notStartedLater,
        startedBeta,
        startedAlpha,
        notStartedSooner,
        expiredEnrollment,
        completedEnrollment,
      ])

      expect(buckets.completed).toEqual([completedEnrollment])
      expect(buckets.expired).toEqual([expiredEnrollment])
      expect(buckets.started).toEqual([startedAlpha, startedBeta])
      expect(buckets.notStarted).toEqual([notStartedSooner, notStartedLater])
    })

    test("classifies a completed enrollment whose end_date has passed as completed, not expired", () => {
      const completedAndExpired = factories.enrollment.courseEnrollment({
        grades: [factories.enrollment.grade({ grade: 0.9, passed: true })],
        run: { start_date: past, end_date: past },
      })

      const buckets = bucketAndSortHomeEnrollments([completedAndExpired])

      expect(buckets.completed).toEqual([completedAndExpired])
      expect(buckets.expired).toEqual([])
    })
  })

  describe("getDistinctDashboardLanguageOptions", () => {
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

      const options = getDistinctDashboardLanguageOptions(
        [course],
        [spanishEnrollment],
      )

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

    test("sorts enrollment-derived language options by label", () => {
      const course = factories.courses.course({
        id: 50,
        language_options: [],
        courseruns: [],
      })

      const frenchEnrollment = factories.enrollment.courseEnrollment({
        run: {
          id: 500,
          language: "fr",
          title: "Run FR",
          run_tag: "FR-1",
          course: { id: 50, title: course.title },
          courseware_id: "cw-fr-500",
          courseware_url: "https://example.com/fr-500",
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
      const spanishEnrollment = factories.enrollment.courseEnrollment({
        run: {
          id: 501,
          language: "es",
          title: "Run ES",
          run_tag: "ES-1",
          course: { id: 50, title: course.title },
          courseware_id: "cw-es-501",
          courseware_url: "https://example.com/es-501",
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
        [frenchEnrollment, spanishEnrollment],
      )

      expect(options.map((option) => option.value)).toEqual([
        "language:es",
        "language:fr",
      ])
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
