import {
  DisplayModeEnum,
  LanguageEnum,
  VariantIndustryEnum,
  VariantLengthEnum,
  type BaseCourseRun,
  type SupportedVariant,
} from "@mitodl/mitxonline-api-axios/v2"
import { factories, RequirementTreeBuilder } from "api/mitxonline-test-utils"
import {
  assembleHomeCardList,
  bucketAndSortHomeEnrollments,
  buildCourseEntry,
  buildRequirementSections,
  buildVariantKey,
  buildVariantLabel,
  enrollmentCourseIsInPrograms,
  getCollectionFirstCoursesInDisplayOrder,
  getModuleCourseIdsFromPrograms,
  getNonContractProgramEnrollments,
  getProgramCoursesInContractOrder,
  getRenderableContractCollections,
  getSortedStandaloneContractPrograms,
  getTopLevelProgramEnrollments,
  groupCourseRunEnrollmentsByCourseId,
  groupModuleCoursesByProgramId,
  groupProgramEnrollmentsByProgramId,
  isNonContractEnrollment,
  isProgramAsCourse,
  pickDisplayedEnrollmentForLegacyDashboard,
  programHasContractRuns,
  resolveDisplayedRunAndEnrollment,
  selectVariantRunForCourse,
  sortVariants,
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

    test("keeps an older enrolled run when the course payload only lists the newer run", () => {
      const olderRun = factories.courses.courseRun({
        id: 101,
        title: "Older run",
      })
      const newerRun = factories.courses.courseRun({
        id: 202,
        title: "Newer run",
      })
      const course = factories.courses.course({
        id: 77,
        courseruns: [newerRun],
        next_run_id: newerRun.id,
      })
      const olderEnrollment = factories.enrollment.courseEnrollment({
        run: {
          id: olderRun.id,
          title: olderRun.title,
          course: { id: course.id, title: course.title },
        },
        certificate: null,
        grades: [],
      })

      expect(
        pickDisplayedEnrollmentForLegacyDashboard(course, [olderEnrollment]),
      ).toEqual(olderEnrollment)
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

  describe("assembleHomeCardList", () => {
    test("orders cards started → notStarted → completed → programEnrollments → expired with type tags", () => {
      const started = factories.enrollment.courseEnrollment()
      const notStarted = factories.enrollment.courseEnrollment()
      const completed = factories.enrollment.courseEnrollment()
      const expired = factories.enrollment.courseEnrollment()
      const programEnrollment = factories.enrollment.programEnrollmentV3()

      const { cards } = assembleHomeCardList({
        started: [started],
        notStarted: [notStarted],
        completed: [completed],
        expired: [expired],
        programEnrollments: [programEnrollment],
      })

      expect(cards).toEqual([
        { type: "courserun-enrollment", data: started },
        { type: "courserun-enrollment", data: notStarted },
        { type: "courserun-enrollment", data: completed },
        { type: "program-enrollment", data: programEnrollment },
        { type: "courserun-enrollment", data: expired },
      ])
    })

    test("initiallyVisibleCount is the non-expired count when any non-expired exist (all expired hidden)", () => {
      const { initiallyVisibleCount, cards } = assembleHomeCardList({
        started: [factories.enrollment.courseEnrollment()],
        notStarted: [],
        completed: [factories.enrollment.courseEnrollment()],
        expired: [
          factories.enrollment.courseEnrollment(),
          factories.enrollment.courseEnrollment(),
        ],
        programEnrollments: [factories.enrollment.programEnrollmentV3()],
      })

      // 1 started + 1 completed + 1 program enrollment visible; 2 expired hidden
      expect(initiallyVisibleCount).toBe(3)
      expect(cards).toHaveLength(5)
    })

    test("promotes up to MIN_VISIBLE expired when there are no non-expired cards", () => {
      const expired = Array.from({ length: 5 }, () =>
        factories.enrollment.courseEnrollment(),
      )

      const { initiallyVisibleCount } = assembleHomeCardList({
        started: [],
        notStarted: [],
        completed: [],
        expired,
        programEnrollments: [],
      })

      expect(initiallyVisibleCount).toBe(3)
    })

    test("shows all expired when there are no non-expired cards and fewer than MIN_VISIBLE expired", () => {
      const { initiallyVisibleCount } = assembleHomeCardList({
        started: [],
        notStarted: [],
        completed: [],
        expired: [
          factories.enrollment.courseEnrollment(),
          factories.enrollment.courseEnrollment(),
        ],
        programEnrollments: [],
      })

      expect(initiallyVisibleCount).toBe(2)
    })

    test("makes every card visible when there are no expired cards", () => {
      const { cards, initiallyVisibleCount } = assembleHomeCardList({
        started: [factories.enrollment.courseEnrollment()],
        notStarted: [],
        completed: [factories.enrollment.courseEnrollment()],
        expired: [],
        programEnrollments: [factories.enrollment.programEnrollmentV3()],
      })

      expect(initiallyVisibleCount).toBe(cards.length)
      expect(cards).toHaveLength(3)
    })

    test("empty input yields no cards and zero visible", () => {
      expect(
        assembleHomeCardList({
          started: [],
          notStarted: [],
          completed: [],
          expired: [],
          programEnrollments: [],
        }),
      ).toEqual({ cards: [], initiallyVisibleCount: 0 })
    })
  })

  describe("contract dashboard helpers", () => {
    test("programHasContractRuns checks course membership in contract course ids", () => {
      const program = factories.programs.program({ courses: [10, 20] })
      const contractCourseIds = new Set([20, 99])

      expect(programHasContractRuns(program, contractCourseIds)).toBe(true)
      expect(programHasContractRuns(program, new Set([99]))).toBe(false)
    })

    test("getSortedStandaloneContractPrograms excludes collection programs and sorts by contract order", () => {
      const programA = factories.programs.program({ id: 1, courses: [101] })
      const programB = factories.programs.program({ id: 2, courses: [102] })
      const programC = factories.programs.program({ id: 3, courses: [103] })
      const contract = factories.contracts.contract({
        programs: [3, 1, 2],
      })
      const collection = factories.programs.programCollection({
        programs: [{ id: 2, title: programB.title, order: 1 }],
      })
      const contractCourses = [
        factories.courses.course({ id: 101 }),
        factories.courses.course({ id: 103 }),
      ]

      const programs = getSortedStandaloneContractPrograms(
        [programA, programB, programC],
        [collection],
        contract,
        contractCourses,
      )

      expect(programs.map((program) => program.id)).toEqual([3, 1])
    })

    test("getSortedStandaloneContractPrograms returns empty when contract has no programs", () => {
      const program = factories.programs.program({ id: 1, courses: [101] })
      const contract = factories.contracts.contract({ programs: [] })

      const programs = getSortedStandaloneContractPrograms(
        [program],
        [],
        contract,
        [factories.courses.course({ id: 101 })],
      )

      expect(programs).toEqual([])
    })

    test("getSortedStandaloneContractPrograms filters by contract course availability", () => {
      const programWithContracts = factories.programs.program({
        id: 1,
        courses: [101, 102],
      })
      const programNoContracts = factories.programs.program({
        id: 2,
        courses: [201, 202],
      })
      const contract = factories.contracts.contract({
        programs: [1, 2],
      })
      const contractCourses = [
        factories.courses.course({ id: 101 }),
        factories.courses.course({ id: 102 }),
      ]

      const programs = getSortedStandaloneContractPrograms(
        [programWithContracts, programNoContracts],
        [],
        contract,
        contractCourses,
      )

      expect(programs.map((p) => p.id)).toEqual([1])
    })

    test("getSortedStandaloneContractPrograms preserves contract-specified sort order", () => {
      const programs = [
        factories.programs.program({ id: 10, courses: [1001] }),
        factories.programs.program({ id: 20, courses: [2001] }),
        factories.programs.program({ id: 30, courses: [3001] }),
      ]
      const contract = factories.contracts.contract({
        programs: [30, 10, 20],
      })
      const contractCourses = [
        factories.courses.course({ id: 1001 }),
        factories.courses.course({ id: 2001 }),
        factories.courses.course({ id: 3001 }),
      ]

      const result = getSortedStandaloneContractPrograms(
        programs,
        [],
        contract,
        contractCourses,
      )

      expect(result.map((p) => p.id)).toEqual([30, 10, 20])
    })

    test("getSortedStandaloneContractPrograms returns empty when all programs are filtered", () => {
      const programInCollection = factories.programs.program({
        id: 1,
        courses: [101],
      })
      const programNoContractRuns = factories.programs.program({
        id: 2,
        courses: [201, 202],
      })
      const contract = factories.contracts.contract({
        programs: [1, 2],
      })
      const collection = factories.programs.programCollection({
        programs: [{ id: 1, title: programInCollection.title, order: 1 }],
      })
      // Contract only has courses 101, so program 2 (courses 201, 202) has no contract runs
      const contractCourses = [factories.courses.course({ id: 101 })]

      const programs = getSortedStandaloneContractPrograms(
        [programInCollection, programNoContractRuns],
        [collection],
        contract,
        contractCourses,
      )

      expect(programs).toEqual([])
    })

    test("getRenderableContractCollections keeps only collections with in-contract programs that have contract runs", () => {
      const programA = factories.programs.program({ id: 10, courses: [1001] })
      const programB = factories.programs.program({ id: 20, courses: [2001] })
      const programC = factories.programs.program({ id: 30, courses: [3001] })
      const contract = factories.contracts.contract({ programs: [10, 20] })

      const noValidRuns = factories.programs.programCollection({
        id: 1,
        programs: [{ id: 10, title: programA.title, order: 1 }],
      })
      const validRuns = factories.programs.programCollection({
        id: 2,
        programs: [{ id: 20, title: programB.title, order: 1 }],
      })
      const outsideContract = factories.programs.programCollection({
        id: 3,
        programs: [{ id: 30, title: programC.title, order: 1 }],
      })

      expect(
        getRenderableContractCollections(
          [noValidRuns, validRuns, outsideContract],
          [programA, programB, programC],
          contract,
          [factories.courses.course({ id: 2001 })],
        ).map((collection) => collection.id),
      ).toEqual([2])
    })

    test("getProgramCoursesInContractOrder preserves program course id order and skips missing", () => {
      const program = factories.programs.program({ courses: [3, 1, 2] })
      const course1 = factories.courses.course({ id: 1 })
      const course2 = factories.courses.course({ id: 2 })

      const courses = getProgramCoursesInContractOrder(program, [
        course2,
        course1,
      ])

      expect(courses.map((course) => course.id)).toEqual([1, 2])
    })

    test("getCollectionFirstCoursesInDisplayOrder follows collection order and selects first available contract course", () => {
      const programA = factories.programs.program({
        id: 10,
        courses: [101, 102],
      })
      const programB = factories.programs.program({ id: 20, courses: [201] })
      const collection = factories.programs.programCollection({
        programs: [
          { id: 10, title: programA.title, order: 2 },
          { id: 20, title: programB.title, order: 1 },
        ],
      })
      const course102 = factories.courses.course({ id: 102 })
      const course201 = factories.courses.course({ id: 201 })

      const courses = getCollectionFirstCoursesInDisplayOrder(
        collection,
        [programA, programB],
        [course102, course201],
      )

      expect(courses.map((course) => course.id)).toEqual([201, 102])
    })
  })

  describe("buildCourseEntry", () => {
    test("returns null displayedEnrollment and a displayedRun when there are no enrollments", () => {
      const run = factories.courses.courseRun({ id: 100 })
      const course = factories.courses.course({
        courseruns: [run],
        next_run_id: run.id,
      })
      const entry = buildCourseEntry(course, [], {})!

      expect(entry.displayedEnrollment).toBeNull()
      expect(entry.displayedRun).not.toBeNull()
      expect(entry.displayedRun?.id).toBe(run.id)
    })

    test("returns correct displayedEnrollment for single enrollment", () => {
      const run = factories.courses.courseRun({ id: 201 })
      const course = factories.courses.course({
        courseruns: [run],
        next_run_id: run.id,
        language_options: [
          {
            id: run.id,
            courseware_id: run.courseware_id,
            courseware_url: run.courseware_url ?? "",
            language: LanguageEnum.En,
            title: run.title,
            run_tag: run.run_tag,
          },
        ],
      })
      const enrollment = factories.enrollment.courseEnrollment({
        run: {
          ...run,
          language: LanguageEnum.En,
          course: { id: course.id, title: course.title },
        },
      })

      const entry = buildCourseEntry(course, [enrollment], {})!

      expect(entry.displayedEnrollment).toBe(enrollment)
      expect(entry.displayedRun?.id).toBe(run.id)
    })

    test("without selected language picks best legacy enrollment (cert > grade)", () => {
      const run = factories.courses.courseRun({ id: 301 })
      const course = factories.courses.course({ courseruns: [run] })
      const noCert = factories.enrollment.courseEnrollment({
        run: { id: run.id },
        certificate: null,
        grades: [factories.enrollment.grade({ grade: 0.5, passed: false })],
      })
      const withCert = factories.enrollment.courseEnrollment({
        run: { id: run.id },
        certificate: { uuid: "cert-abc" },
        grades: [factories.enrollment.grade({ grade: 0.9, passed: true })],
      })

      // no selectedLanguageKey → legacy path
      const entry = buildCourseEntry(course, [noCert, withCert], {})!

      expect(entry.displayedEnrollment).toBe(withCert)
    })

    test("contract-scoped: does not pick an enrollment from a different contract", () => {
      const run = factories.courses.courseRun({
        id: 501,
        b2b_contract: 10,
        courseware_id: "cw-501",
        courseware_url: "https://example.com/501",
        is_enrollable: true,
      })
      const course = factories.courses.course({
        courseruns: [run],
        next_run_id: run.id,
        language_options: [
          {
            id: run.id,
            courseware_id: run.courseware_id,
            courseware_url: run.courseware_url ?? "",
            language: LanguageEnum.En,
            title: run.title,
            run_tag: run.run_tag,
          },
        ],
      })
      // enrollment belongs to contract 99, not contract 10
      const otherContractEnrollment = factories.enrollment.courseEnrollment({
        b2b_contract_id: 99,
        run: {
          ...run,
          language: LanguageEnum.En,
          course: { id: course.id, title: course.title },
        },
      })

      const entry = buildCourseEntry(course, [otherContractEnrollment], {
        contractId: 10,
      })!

      expect(entry.displayedEnrollment).toBeNull()
    })

    test("contract-scoped: picks the matching-contract enrollment when multiple are present", () => {
      const run = factories.courses.courseRun({
        id: 501,
        b2b_contract: 1,
        courseware_id: "cw-501",
        is_enrollable: true,
      })
      const course = factories.courses.course({
        courseruns: [run],
        next_run_id: run.id,
        language_options: [
          {
            id: run.id,
            courseware_id: run.courseware_id,
            courseware_url: run.courseware_url ?? "",
            language: LanguageEnum.En,
            title: run.title,
            run_tag: run.run_tag,
          },
        ],
      })
      const otherContractEnrollment = factories.enrollment.courseEnrollment({
        b2b_contract_id: 2,
        run: { ...run, course: { id: course.id, title: course.title } },
      })
      const selectedContractEnrollment = factories.enrollment.courseEnrollment({
        b2b_contract_id: 1,
        run: { ...run, course: { id: course.id, title: course.title } },
      })

      const entry = buildCourseEntry(
        course,
        [otherContractEnrollment, selectedContractEnrollment],
        {
          contractId: 1,
        },
      )!

      expect(entry.displayedEnrollment?.b2b_contract_id).toBe(1)
    })

    test("stores all input enrollments uncollapsed regardless of displayedEnrollment choice", () => {
      const run = factories.courses.courseRun({ id: 601 })
      const course = factories.courses.course({ courseruns: [run] })
      const e1 = factories.enrollment.courseEnrollment({
        run: { id: run.id },
        certificate: null,
      })
      const e2 = factories.enrollment.courseEnrollment({
        run: { id: run.id },
        certificate: { uuid: "cert-xyz" },
      })

      const entry = buildCourseEntry(course, [e1, e2], {})!

      // displayedEnrollment picks best one (e2), but all remain on entry
      expect(entry.enrollments).toEqual([e1, e2])
      expect(entry.displayedEnrollment).toBe(e2)
    })

    test("passthrough: course, contractId, and ancestorContext are stored verbatim", () => {
      const run = factories.courses.courseRun({ id: 701 })
      const course = factories.courses.course({ courseruns: [run] })
      const programEnrollment = factories.enrollment.programEnrollmentV3()
      const ancestorContext = { programEnrollment }

      const entry = buildCourseEntry(course, [], {
        contractId: 42,
        ancestorContext,
      })!

      expect(entry.course).toBe(course)
      expect(entry.contractId).toBe(42)
      expect(entry.ancestorContext).toBe(ancestorContext)
    })

    test("isContractPageResource is stored verbatim", () => {
      const course = factories.courses.course()

      const entry = buildCourseEntry(course, [], {
        isContractPageResource: true,
      })!

      expect(entry.isContractPageResource).toBe(true)
    })
  })

  describe("buildRequirementSections", () => {
    /**
     * Builds a flat req_tree with one all_of section containing the given course ids.
     * Convenience helper for tests that only need one section.
     */
    const makeSingleSectionReqTree = (courseIds: number[]) => {
      const root = new RequirementTreeBuilder()
      const op = root.addOperator({ operator: "all_of", title: "Core Courses" })
      courseIds.forEach((id) => op.addCourse({ course: id }))
      return root.serialize()
    }

    test("produces a course arm item for each course found in programCourses", () => {
      const course = factories.courses.course({ id: 1001 })
      const reqTree = makeSingleSectionReqTree([course.id])

      const { sections } = buildRequirementSections({
        reqTree,
        programCourses: [course],
        enrollmentsByCourseId: {},
        programEnrollmentsById: {},
        requiredPrograms: [],
        requiredProgramModuleCoursesByProgramId: {},
      })

      expect(sections).toHaveLength(1)
      expect(sections[0].items).toHaveLength(1)
      expect(sections[0].items[0].kind).toBe("course")
      if (sections[0].items[0].kind === "course") {
        expect(sections[0].items[0].entry.course).toBe(course)
      }
    })

    test("drops a course item when course id is not in programCourses", () => {
      const reqTree = makeSingleSectionReqTree([9999])

      const { sections } = buildRequirementSections({
        reqTree,
        programCourses: [], // 9999 not present
        enrollmentsByCourseId: {},
        programEnrollmentsById: {},
        requiredPrograms: [],
        requiredProgramModuleCoursesByProgramId: {},
      })

      // Section has no items → filtered out
      expect(sections).toHaveLength(0)
    })

    test("produces a program-as-course arm for programs with display_mode Course", () => {
      const moduleCourse = factories.courses.course({ id: 2001 })
      const requiredProgram = factories.programs.program({
        id: 3001,
        display_mode: DisplayModeEnum.Course,
        courses: [moduleCourse.id],
      })
      const programEnrollment = factories.enrollment.programEnrollmentV3({
        program: factories.programs.simpleProgram({ id: requiredProgram.id }),
      })
      const programEnrollmentsById = {
        [requiredProgram.id]: programEnrollment,
      }
      const root = new RequirementTreeBuilder()
      const op = root.addOperator({ operator: "all_of", title: "Modules" })
      op.addProgram({ program: requiredProgram.id })
      const reqTree = root.serialize()

      const { sections } = buildRequirementSections({
        reqTree,
        programCourses: [],
        enrollmentsByCourseId: {},
        programEnrollmentsById,
        requiredPrograms: [requiredProgram],
        requiredProgramModuleCoursesByProgramId: {
          [requiredProgram.id]: [moduleCourse],
        },
      })

      expect(sections).toHaveLength(1)
      expect(sections[0].items[0].kind).toBe("program-as-course")
      if (sections[0].items[0].kind === "program-as-course") {
        expect(sections[0].items[0].courseProgram).toBe(requiredProgram)
        expect(sections[0].items[0].moduleCourses).toEqual([moduleCourse])
        expect(sections[0].items[0].courseProgramEnrollment).toBe(
          programEnrollment,
        )
      }
    })

    test("produces a program-enrollment arm for regular programs that have an enrollment", () => {
      const requiredProgram = factories.programs.program({
        id: 4001,
        display_mode: null,
      })
      const programEnrollment = factories.enrollment.programEnrollmentV3({
        program: factories.programs.simpleProgram({ id: requiredProgram.id }),
      })
      const root = new RequirementTreeBuilder()
      const op = root.addOperator({ operator: "all_of", title: "Programs" })
      op.addProgram({ program: requiredProgram.id })
      const reqTree = root.serialize()

      const { sections } = buildRequirementSections({
        reqTree,
        programCourses: [],
        enrollmentsByCourseId: {},
        programEnrollmentsById: { [requiredProgram.id]: programEnrollment },
        requiredPrograms: [requiredProgram],
        requiredProgramModuleCoursesByProgramId: {},
      })

      expect(sections).toHaveLength(1)
      expect(sections[0].items[0].kind).toBe("program-enrollment")
      if (sections[0].items[0].kind === "program-enrollment") {
        expect(sections[0].items[0].enrollment).toBe(programEnrollment)
      }
    })

    test("drops a regular program item when there is no enrollment for it", () => {
      const requiredProgram = factories.programs.program({
        id: 5001,
        display_mode: null,
      })
      const root = new RequirementTreeBuilder()
      const op = root.addOperator({ operator: "all_of", title: "Programs" })
      op.addProgram({ program: requiredProgram.id })
      const reqTree = root.serialize()

      const { sections } = buildRequirementSections({
        reqTree,
        programCourses: [],
        enrollmentsByCourseId: {},
        programEnrollmentsById: {}, // no enrollment for this program
        requiredPrograms: [requiredProgram],
        requiredProgramModuleCoursesByProgramId: {},
      })

      expect(sections).toHaveLength(0)
    })

    test("drops a program item when the program id is not in requiredPrograms", () => {
      const root = new RequirementTreeBuilder()
      const op = root.addOperator({ operator: "all_of", title: "Programs" })
      op.addProgram({ program: 9999 })
      const reqTree = root.serialize()

      const { sections } = buildRequirementSections({
        reqTree,
        programCourses: [],
        enrollmentsByCourseId: {},
        programEnrollmentsById: {},
        requiredPrograms: [], // 9999 not present
        requiredProgramModuleCoursesByProgramId: {},
      })

      expect(sections).toHaveLength(0)
    })

    test("filters out sections with no items", () => {
      const root = new RequirementTreeBuilder()
      // Section A — will have an item
      const opA = root.addOperator({ operator: "all_of", title: "Section A" })
      const courseA = factories.courses.course({ id: 6001 })
      opA.addCourse({ course: courseA.id })
      // Section B — course not in programCourses → no items
      const opB = root.addOperator({ operator: "all_of", title: "Section B" })
      opB.addCourse({ course: 9999 })
      const reqTree = root.serialize()

      const { sections } = buildRequirementSections({
        reqTree,
        programCourses: [courseA],
        enrollmentsByCourseId: {},
        programEnrollmentsById: {},
        requiredPrograms: [],
        requiredProgramModuleCoursesByProgramId: {},
      })

      expect(sections).toHaveLength(1)
      expect(sections[0].title).toBe("Section A")
    })

    test("preserves req_tree ordering across sections", () => {
      const c1 = factories.courses.course({ id: 7001 })
      const c2 = factories.courses.course({ id: 7002 })
      const c3 = factories.courses.course({ id: 7003 })
      const root = new RequirementTreeBuilder()
      const op1 = root.addOperator({ operator: "all_of", title: "First" })
      op1.addCourse({ course: c1.id })
      const op2 = root.addOperator({ operator: "all_of", title: "Second" })
      op2.addCourse({ course: c2.id })
      const op3 = root.addOperator({ operator: "all_of", title: "Third" })
      op3.addCourse({ course: c3.id })
      const reqTree = root.serialize()

      const { sections } = buildRequirementSections({
        reqTree,
        programCourses: [c1, c2, c3],
        enrollmentsByCourseId: {},
        programEnrollmentsById: {},
        requiredPrograms: [],
        requiredProgramModuleCoursesByProgramId: {},
      })

      expect(sections.map((s) => s.title)).toEqual(["First", "Second", "Third"])
    })

    test("per-section completed/total: one passing enrollment → completed=1, total=1", () => {
      const course = factories.courses.course({ id: 8001 })
      const root = new RequirementTreeBuilder()
      const op = root.addOperator({ operator: "all_of", title: "Core" })
      op.addCourse({ course: course.id })
      const reqTree = root.serialize()

      const enrollment = factories.enrollment.courseEnrollment({
        run: { course: { id: course.id } },
        grades: [factories.enrollment.grade({ passed: true })],
      })

      const { sections } = buildRequirementSections({
        reqTree,
        programCourses: [course],
        enrollmentsByCourseId: { [course.id]: [enrollment] },
        programEnrollmentsById: {},
        requiredPrograms: [],
        requiredProgramModuleCoursesByProgramId: {},
      })

      expect(sections[0].completed).toBe(1)
      expect(sections[0].total).toBe(1)
    })

    test("overall counts are computed over POST-filter sections only (ghost dropped section does not inflate counts)", () => {
      // keptCourse appears in programCourses → its section survives the filter.
      // ghostCourseId is absent from programCourses → its section is dropped.
      // The ghost enrollment has a passing grade, so a buggy pre-filter
      // implementation (counting over ALL parsed sections before the
      // `items.length > 0` filter) would report completedCount=1 and totalCount=2
      // instead of the correct completedCount=0 and totalCount=1.
      const keptCourse = factories.courses.course({ id: 9001 })
      const ghostCourseId = 9999

      const root = new RequirementTreeBuilder()
      const opKept = root.addOperator({ operator: "all_of", title: "Kept" })
      opKept.addCourse({ course: keptCourse.id })
      const opDropped = root.addOperator({
        operator: "all_of",
        title: "Dropped",
      })
      opDropped.addCourse({ course: ghostCourseId })
      const reqTree = root.serialize()

      const ghostEnrollment = factories.enrollment.courseEnrollment({
        run: { course: { id: ghostCourseId } },
        grades: [factories.enrollment.grade({ passed: true })],
      })

      const result = buildRequirementSections({
        reqTree,
        // keptCourse is present; ghostCourseId is intentionally absent →
        // the "Dropped" section will have no items and be filtered out.
        programCourses: [keptCourse],
        enrollmentsByCourseId: { [ghostCourseId]: [ghostEnrollment] },
        programEnrollmentsById: {},
        requiredPrograms: [],
        requiredProgramModuleCoursesByProgramId: {},
      })

      // Only the "Kept" section survives; the ghost section is dropped.
      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].title).toBe("Kept")
      // totalCount = 1 (only the kept course); completedCount = 0 (no enrollment for keptCourse).
      // A buggy pre-filter implementation would return totalCount=2, completedCount=1.
      expect(result.totalCount).toBe(1)
      expect(result.completedCount).toBe(0)
    })

    describe("getRequirementSectionTitle behavior", () => {
      test("uses node.data.title when present", () => {
        const c = factories.courses.course({ id: 10001 })
        const root = new RequirementTreeBuilder()
        const op = root.addOperator({
          operator: "all_of",
          title: "Custom Section Title",
        })
        op.addCourse({ course: c.id })
        const reqTree = root.serialize()

        const { sections } = buildRequirementSections({
          reqTree,
          programCourses: [c],
          enrollmentsByCourseId: {},
          programEnrollmentsById: {},
          requiredPrograms: [],
          requiredProgramModuleCoursesByProgramId: {},
        })

        expect(sections[0].title).toBe("Custom Section Title")
      })

      test("returns 'Electives (Complete N)' for min_number_of elective with operator_value", () => {
        const c = factories.courses.course({ id: 10002 })
        const root = new RequirementTreeBuilder()
        // RequirementTreeBuilder sets elective_flag=true for min_number_of operators
        const op = root.addOperator({
          operator: "min_number_of",
          operator_value: "3",
        })
        op.addCourse({ course: c.id })
        const reqTree = root.serialize()
        // Manually clear the auto-set title so that the title fallback logic kicks in
        reqTree[0].data.title = null

        const { sections } = buildRequirementSections({
          reqTree,
          programCourses: [c],
          enrollmentsByCourseId: {},
          programEnrollmentsById: {},
          requiredPrograms: [],
          requiredProgramModuleCoursesByProgramId: {},
        })

        expect(sections[0].title).toBe("Electives (Complete 3)")
      })

      test("returns 'Elective Courses' for elective without operator_value", () => {
        const c = factories.courses.course({ id: 10003 })
        // Build node manually to control all data fields precisely
        const opNode = {
          id: 55555,
          data: {
            node_type: "operator" as const,
            operator: "all_of" as const,
            operator_value: null,
            elective_flag: true,
            title: null,
            course: null,
            required_program: null,
          },
          children: [
            {
              id: 55556,
              data: {
                node_type: "course" as const,
                course: c.id,
                operator: null,
                operator_value: null,
                elective_flag: false,
                title: null,
                required_program: null,
              },
              children: [],
            },
          ],
        }

        const { sections } = buildRequirementSections({
          reqTree: [opNode],
          programCourses: [c],
          enrollmentsByCourseId: {},
          programEnrollmentsById: {},
          requiredPrograms: [],
          requiredProgramModuleCoursesByProgramId: {},
        })

        expect(sections[0].title).toBe("Elective Courses")
      })

      test("returns 'Core Courses' when no title and not elective", () => {
        const c = factories.courses.course({ id: 10004 })
        const opNode = {
          id: 66666,
          data: {
            node_type: "operator" as const,
            operator: "all_of" as const,
            operator_value: null,
            elective_flag: false,
            title: null,
            course: null,
            required_program: null,
          },
          children: [
            {
              id: 66667,
              data: {
                node_type: "course" as const,
                course: c.id,
                operator: null,
                operator_value: null,
                elective_flag: false,
                title: null,
                required_program: null,
              },
              children: [],
            },
          ],
        }

        const { sections } = buildRequirementSections({
          reqTree: [opNode],
          programCourses: [c],
          enrollmentsByCourseId: {},
          programEnrollmentsById: {},
          requiredPrograms: [],
          requiredProgramModuleCoursesByProgramId: {},
        })

        expect(sections[0].title).toBe("Core Courses")
      })
    })

    test("course arm entry carries ancestorContext from ancestorProgramEnrollment", () => {
      const course = factories.courses.course({ id: 11001 })
      const reqTree = makeSingleSectionReqTree([course.id])
      const programEnrollment = factories.enrollment.programEnrollmentV3()

      const { sections } = buildRequirementSections({
        reqTree,
        programCourses: [course],
        enrollmentsByCourseId: {},
        programEnrollmentsById: {},
        requiredPrograms: [],
        requiredProgramModuleCoursesByProgramId: {},
        ancestorProgramEnrollment: programEnrollment,
      })

      const item = sections[0].items[0]
      expect(item.kind).toBe("course")
      if (item.kind === "course") {
        expect(item.entry.ancestorContext?.programEnrollment).toBe(
          programEnrollment,
        )
      }
    })

    test("section key equals node id", () => {
      const c = factories.courses.course({ id: 12001 })
      const opNode = {
        id: 77777,
        data: {
          node_type: "operator" as const,
          operator: "all_of" as const,
          operator_value: null,
          elective_flag: false,
          title: "Keyed Section",
          course: null,
          required_program: null,
        },
        children: [
          {
            id: 77778,
            data: {
              node_type: "course" as const,
              course: c.id,
              operator: null,
              operator_value: null,
              elective_flag: false,
              title: null,
              required_program: null,
            },
            children: [],
          },
        ],
      }

      const { sections } = buildRequirementSections({
        reqTree: [opNode],
        programCourses: [c],
        enrollmentsByCourseId: {},
        programEnrollmentsById: {},
        requiredPrograms: [],
        requiredProgramModuleCoursesByProgramId: {},
      })

      expect(sections[0].key).toBe(opNode.id)
    })
  })

  describe("resolveDisplayedRunAndEnrollment", () => {
    test("variant path: prefers an enrolled run matching the variant over candidate runs", () => {
      // User is enrolled in an older run matching the variant. A newer
      // enrollable candidate also matches. The enrolled run must win.
      const enrolledRun = factories.courses.courseRun({
        id: 11,
        language: LanguageEnum.En,
        variant_industry: VariantIndustryEnum.E,
        variant_length: "",
        is_enrollable: false,
        start_date: "2024-01-01T00:00:00Z",
      })
      const newerCandidateRun = factories.courses.courseRun({
        id: 12,
        language: LanguageEnum.En,
        variant_industry: VariantIndustryEnum.E,
        variant_length: "",
        is_enrollable: true,
        start_date: "2025-06-01T00:00:00Z",
      })
      const course = factories.courses.course({
        id: 1,
        courseruns: [enrolledRun, newerCandidateRun],
        next_run_id: newerCandidateRun.id,
      })
      const variant: SupportedVariant = {
        language: LanguageEnum.En,
        variant_industry: VariantIndustryEnum.E,
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: false,
      }
      const enrollment = factories.enrollment.courseEnrollment({
        run: {
          ...enrolledRun,
          language: LanguageEnum.En,
          variant_industry: VariantIndustryEnum.E,
          variant_length: "",
          course: { id: course.id, title: course.title },
        },
      })

      const resolved = resolveDisplayedRunAndEnrollment(course, [enrollment], {
        variant,
        variantCandidateRuns: [enrolledRun, newerCandidateRun],
      })

      expect(resolved.displayedEnrollment?.run.id).toBe(enrolledRun.id)
      expect(resolved.displayedRun?.id).toBe(enrolledRun.id)
    })

    test("does not pick enrollment from another contract", () => {
      const run = factories.courses.courseRun({
        id: 21,
        b2b_contract: 1,
        courseware_id: "cw-21",
        courseware_url: "https://example.com/21",
        is_enrollable: true,
      })
      const course = factories.courses.course({
        id: 2,
        courseruns: [run],
        next_run_id: run.id,
      })
      const otherContractEnrollment = factories.enrollment.courseEnrollment({
        b2b_contract_id: 2,
        run: {
          ...run,
          course: { id: course.id, title: course.title },
        },
      })

      const resolved = resolveDisplayedRunAndEnrollment(
        course,
        [otherContractEnrollment],
        { contractId: 1 },
      )

      expect(resolved.displayedEnrollment).toBeNull()
    })

    test("variant path: returns best candidate run when user is not enrolled", () => {
      // No enrollment; the enrollable candidate should be picked over the
      // unenrollable one (enrollable-first sort in selectVariantRunForCourse).
      const unenrollableRun = factories.courses.courseRun({
        id: 31,
        language: LanguageEnum.En,
        variant_industry: VariantIndustryEnum.F,
        variant_length: "",
        is_enrollable: false,
        start_date: "2025-01-01T00:00:00Z",
      })
      const enrollableRun = factories.courses.courseRun({
        id: 32,
        language: LanguageEnum.En,
        variant_industry: VariantIndustryEnum.F,
        variant_length: "",
        is_enrollable: true,
        start_date: "2024-06-01T00:00:00Z",
      })
      const course = factories.courses.course({
        id: 3,
        courseruns: [unenrollableRun, enrollableRun],
        next_run_id: enrollableRun.id,
      })
      const variant: SupportedVariant = {
        language: LanguageEnum.En,
        variant_industry: VariantIndustryEnum.F,
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: false,
      }

      const resolved = resolveDisplayedRunAndEnrollment(course, [], {
        variant,
        variantCandidateRuns: [unenrollableRun, enrollableRun],
      })

      expect(resolved.displayedEnrollment).toBeNull()
      expect(resolved.displayedRun?.id).toBe(enrollableRun.id)
    })

    test("does not surface a variant enrollment when the default variant is active", () => {
      // Regression: user enrolls in Spanish run, then switches picker back to
      // English default variant. The Spanish enrollment must be excluded and
      // the English run must be the displayedRun.
      const englishRun = factories.courses.courseRun({
        id: 41,
        language: LanguageEnum.En,
        variant_industry: "",
        variant_length: "",
        is_enrollable: true,
        b2b_contract: 5,
      })
      const spanishRun = factories.courses.courseRun({
        id: 42,
        language: LanguageEnum.EsEs,
        variant_industry: "",
        variant_length: "",
        is_enrollable: true,
        b2b_contract: 5,
      })
      const course = factories.courses.course({
        id: 4,
        courseruns: [englishRun, spanishRun],
        next_run_id: englishRun.id,
      })
      const spanishEnrollment = factories.enrollment.courseEnrollment({
        b2b_contract_id: 5,
        run: {
          ...spanishRun,
          language: LanguageEnum.EsEs,
          course: { id: course.id, title: course.title },
        },
      })
      const defaultEnglishVariant: SupportedVariant = {
        language: LanguageEnum.En,
        variant_industry: "",
        variant_length: "",
        active: true,
        b2b_only: true,
        default_variant: true,
      }

      const resolved = resolveDisplayedRunAndEnrollment(
        course,
        [spanishEnrollment],
        { contractId: 5, variant: defaultEnglishVariant },
      )

      expect(resolved.displayedEnrollment).toBeNull()
      expect(resolved.displayedRun?.id).toBe(englishRun.id)
    })

    test("non-enrollable fallback: picks the run with the most recent start_date when no runs are enrollable and next_run_id is null", () => {
      // Regression: capstone exams have next_run_id=null and is_enrollable=false
      // on all runs. The stale (older) run must NOT be picked just because it
      // appears first in the courseruns array.
      const staleRun = factories.courses.courseRun({
        id: 563,
        title: "[WRONG] Supply Chain Exam - Stale 2023 Run",
        is_enrollable: false,
        start_date: "2023-09-01T00:00:00Z",
      })
      const currentRun = factories.courses.courseRun({
        id: 564,
        title: "[CORRECT] Supply Chain Exam - Current 2026 Run",
        is_enrollable: false,
        start_date: "2026-03-01T00:00:00Z",
      })
      const course = factories.courses.course({
        // API returns stale run first — our fix must ignore array order
        courseruns: [staleRun, currentRun],
        next_run_id: null,
      })

      const resolved = resolveDisplayedRunAndEnrollment(course, [])

      expect(resolved.displayedEnrollment).toBeNull()
      expect(resolved.displayedRun?.id).toBe(currentRun.id)
    })
  })
})

// ---------------------------------------------------------------------------
// Variant picker model helpers
// ---------------------------------------------------------------------------

const makeVariant = (
  overrides: Partial<SupportedVariant> = {},
): SupportedVariant => ({
  language: LanguageEnum.En,
  variant_industry: "",
  variant_length: "",
  active: true,
  b2b_only: true,
  default_variant: false,
  ...overrides,
})

const makeRun = (overrides: Partial<BaseCourseRun> = {}): BaseCourseRun => ({
  id: 1,
  course_id: 1,
  title: "Test Run",
  courseware_id: "course-v1:test+run",
  courseware_url: "https://example.com",
  run_tag: "R1",
  course_number: "T101",
  language: LanguageEnum.En,
  language_label: "",
  enrollment_modes: [],
  is_upgradable: false,
  is_enrollable: true,
  is_archived: false,
  ...overrides,
})

describe("buildVariantKey", () => {
  test("encodes language, industry, and length into a stable string", () => {
    expect(
      buildVariantKey(
        makeVariant({
          language: LanguageEnum.En,
          variant_industry: "",
          variant_length: "",
        }),
      ),
    ).toBe("language:en|industry:|length:")
  })

  test("includes a non-empty industry value", () => {
    expect(
      buildVariantKey(makeVariant({ variant_industry: VariantIndustryEnum.E })),
    ).toBe("language:en|industry:E|length:")
  })

  test("includes a non-empty length value", () => {
    expect(
      buildVariantKey(makeVariant({ variant_length: VariantLengthEnum.S })),
    ).toBe("language:en|industry:|length:S")
  })

  test("encodes all three dimensions together", () => {
    expect(
      buildVariantKey(
        makeVariant({
          language: LanguageEnum.EsEs,
          variant_industry: VariantIndustryEnum.Hc,
          variant_length: VariantLengthEnum.F,
        }),
      ),
    ).toBe("language:es_ES|industry:HC|length:F")
  })
})

describe("buildVariantLabel", () => {
  test("returns language name with General and Full defaults when no modifiers set", () => {
    expect(buildVariantLabel(makeVariant({ language: LanguageEnum.En }))).toBe(
      "English • General • Full",
    )
  })

  test("uses the Spanish native name for es_ES", () => {
    expect(
      buildVariantLabel(makeVariant({ language: LanguageEnum.EsEs })),
    ).toMatch(/español/i)
  })

  test("includes the industry label when variant_industry is set", () => {
    expect(
      buildVariantLabel(
        makeVariant({ variant_industry: VariantIndustryEnum.F }),
      ),
    ).toBe("English • Finance • Full")
  })

  test("includes the length label when variant_length is set", () => {
    expect(
      buildVariantLabel(makeVariant({ variant_length: VariantLengthEnum.S })),
    ).toBe("English • General • Short")
  })

  test("combines all three when all dimensions are set", () => {
    expect(
      buildVariantLabel(
        makeVariant({
          language: LanguageEnum.En,
          variant_industry: VariantIndustryEnum.Hc,
          variant_length: VariantLengthEnum.F,
        }),
      ),
    ).toBe("English • Healthcare • Full")
  })

  test("falls back to raw value for an unknown industry code", () => {
    expect(
      buildVariantLabel(makeVariant({ variant_industry: "XY" as never })),
    ).toBe("English • XY • Full")
  })

  test("falls back to raw value for an unknown length code", () => {
    expect(
      buildVariantLabel(makeVariant({ variant_length: "XZ" as never })),
    ).toBe("English • General • XZ")
  })
})

describe("sortVariants", () => {
  test("groups the default's language first, then orders other languages alphabetically", () => {
    // French is the default. Its label "Français" sorts alphabetically AFTER
    // "English" and "Español", so the only reason the French variants lead is
    // the default-language grouping rule — not alphabetical order.
    const def = makeVariant({
      language: LanguageEnum.Fr,
      default_variant: true,
    })
    const frEnergyFull = makeVariant({
      language: LanguageEnum.Fr,
      variant_industry: VariantIndustryEnum.E,
      variant_length: VariantLengthEnum.F,
    })
    const frEnergyShort = makeVariant({
      language: LanguageEnum.Fr,
      variant_industry: VariantIndustryEnum.E,
      variant_length: VariantLengthEnum.S,
    })
    const frFinance = makeVariant({
      language: LanguageEnum.Fr,
      variant_industry: VariantIndustryEnum.F,
    })
    const english = makeVariant({ language: LanguageEnum.En })
    const spanish = makeVariant({ language: LanguageEnum.EsEs })

    const input = [
      spanish,
      frFinance,
      english,
      def,
      frEnergyShort,
      frEnergyFull,
    ]

    expect(sortVariants(input)).toEqual([
      // default always first
      def,
      // rest of the default's language (French), by industry then length:
      // Energy < Finance, with Energy's Full < Short tie-break on length
      frEnergyFull,
      frEnergyShort,
      frFinance,
      // then the other languages alphabetically: English < Español
      english,
      spanish,
    ])
    // input is not mutated
    expect(input[0]).toBe(spanish)
  })

  test("with no default variant, orders purely alphabetically by language", () => {
    // No variant has default_variant: true, so there is no language to hoist
    // and ordering falls through to the alphabetical language comparison.
    const french = makeVariant({ language: LanguageEnum.Fr })
    const english = makeVariant({ language: LanguageEnum.En })
    const spanish = makeVariant({ language: LanguageEnum.EsEs })

    // English < Español < Français
    expect(sortVariants([french, spanish, english])).toEqual([
      english,
      spanish,
      french,
    ])
  })
})

describe("selectVariantRunForCourse", () => {
  test("returns null for an empty runs list", () => {
    expect(selectVariantRunForCourse([], makeVariant())).toBeNull()
  })

  test("returns null when no run matches the selected language", () => {
    const run = makeRun({ language: LanguageEnum.EsEs })
    expect(
      selectVariantRunForCourse(
        [run],
        makeVariant({ language: LanguageEnum.Fr }),
      ),
    ).toBeNull()
  })

  test("returns the run that matches the selected language", () => {
    const enRun = makeRun({ id: 1, language: LanguageEnum.En })
    const esRun = makeRun({ id: 2, language: LanguageEnum.EsEs })
    expect(
      selectVariantRunForCourse(
        [enRun, esRun],
        makeVariant({ language: LanguageEnum.EsEs }),
      ),
    ).toBe(esRun)
  })

  test("returns null when no run matches the selected industry", () => {
    const run = makeRun({
      language: LanguageEnum.En,
      variant_industry: VariantIndustryEnum.E,
    })
    expect(
      selectVariantRunForCourse(
        [run],
        makeVariant({ variant_industry: VariantIndustryEnum.F }),
      ),
    ).toBeNull()
  })

  test("does not match a run with a non-empty industry when variant_industry is empty (exact match)", () => {
    const run = makeRun({
      id: 5,
      language: LanguageEnum.En,
      variant_industry: VariantIndustryEnum.E,
    })
    expect(
      selectVariantRunForCourse([run], makeVariant({ variant_industry: "" })),
    ).toBeNull()
  })

  test("returns null when no run matches the selected length", () => {
    const run = makeRun({
      language: LanguageEnum.En,
      variant_length: VariantLengthEnum.F,
    })
    expect(
      selectVariantRunForCourse(
        [run],
        makeVariant({ variant_length: VariantLengthEnum.S }),
      ),
    ).toBeNull()
  })

  test("does not match a run with a non-empty length when variant_length is empty (exact match)", () => {
    const run = makeRun({
      id: 7,
      language: LanguageEnum.En,
      variant_length: VariantLengthEnum.S,
    })
    expect(
      selectVariantRunForCourse([run], makeVariant({ variant_length: "" })),
    ).toBeNull()
  })

  test("among same-enrollability runs, prefers the latest start date", () => {
    const nearFuture = makeRun({ id: 1, start_date: "2099-01-01T00:00:00Z" })
    const farFuture = makeRun({ id: 2, start_date: "2099-12-31T00:00:00Z" })
    expect(
      selectVariantRunForCourse([farFuture, nearFuture], makeVariant()),
    ).toBe(farFuture)
  })

  test("prefers any upcoming date over any past date", () => {
    const past = makeRun({ id: 1, start_date: "2020-01-01T00:00:00Z" })
    const future = makeRun({ id: 2, start_date: "2099-01-01T00:00:00Z" })
    expect(selectVariantRunForCourse([past, future], makeVariant())).toBe(
      future,
    )
  })

  test("among past-only runs, picks the most recent", () => {
    const older = makeRun({ id: 1, start_date: "2020-01-01T00:00:00Z" })
    const newer = makeRun({ id: 2, start_date: "2023-06-15T00:00:00Z" })
    expect(selectVariantRunForCourse([older, newer], makeVariant())).toBe(newer)
  })

  test("runs with no start date are ranked last", () => {
    const noDate = makeRun({ id: 1, start_date: null })
    const past = makeRun({ id: 2, start_date: "2020-01-01T00:00:00Z" })
    expect(selectVariantRunForCourse([noDate, past], makeVariant())).toBe(past)
  })
})
