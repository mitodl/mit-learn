import React, { act } from "react"
import { renderHook, waitFor } from "@/test-utils"
import { QueryClientProvider } from "@tanstack/react-query"
import { makeBrowserQueryClient } from "@/app/getQueryClient"
import * as mitxonline from "api/mitxonline-test-utils"
import { useProgramDashboardData } from "./useProgramDashboardData"
import { buildProgramScenario } from "../test-utils"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"

const makeProgramEnrollment = (
  program: V2ProgramDetail,
  overrides: Parameters<
    typeof mitxonline.factories.enrollment.programEnrollmentV3
  >[0] = {},
) =>
  mitxonline.factories.enrollment.programEnrollmentV3({
    program: {
      id: program.id,
      title: program.title,
      live: program.live,
      program_type: program.program_type,
      readable_id: program.readable_id,
    },
    ...overrides,
  })

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = makeBrowserQueryClient({ maxRetries: 0 })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const renderUseProgramDashboardData = (programId: number) =>
  renderHook(() => useProgramDashboardData(programId), { wrapper })

/**
 * Asserts the composer's durable returned contract: sections structure,
 * counts, language options, shared aux, and representative wiring assertions.
 * Never asserts through `adaptCourseEntryToLegacyDashboardCardProps`
 * (Phase-7-stable per the durable-contract assertion rule).
 */
describe("useProgramDashboardData", () => {
  test("reports loading until all 6 queries resolve, then returns data", async () => {
    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const section = reqTree.addOperator({
      operator: "all_of",
      title: "Core Courses",
    })
    section.addCourse({ course: 1 })

    const program = mitxonline.factories.programs.program({
      id: 100,
      courses: [1],
      req_tree: reqTree.serialize(),
    })
    const course = mitxonline.factories.courses.course({ id: 1 })
    const programEnrollment = makeProgramEnrollment(program)

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programCourses: [course],
      programEnrollments: [programEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  test("returns enrolledInProgram=false when user has no matching program enrollment", async () => {
    const program = mitxonline.factories.programs.program({
      id: 200,
      courses: [],
    })
    const otherEnrollment = mitxonline.factories.enrollment.programEnrollmentV3(
      {
        program: { id: 999 },
      },
    )

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programEnrollments: [otherEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.enrolledInProgram).toBe(false)
  })

  test("returns correct section structure and ordering for a simple program", async () => {
    const course1 = mitxonline.factories.courses.course({ id: 10 })
    const course2 = mitxonline.factories.courses.course({ id: 11 })

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const coreSection = reqTree.addOperator({
      operator: "all_of",
      title: "Core Courses",
    })
    coreSection.addCourse({ course: course1.id })
    coreSection.addCourse({ course: course2.id })

    const program = mitxonline.factories.programs.program({
      id: 300,
      courses: [course1.id, course2.id],
      req_tree: reqTree.serialize(),
    })
    const programEnrollment = makeProgramEnrollment(program)

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programCourses: [course1, course2],
      programEnrollments: [programEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.sections).toHaveLength(1)
    expect(result.current.sections[0].title).toBe("Core Courses")
    expect(result.current.sections[0].items).toHaveLength(2)
    // req_tree order preserved
    expect(result.current.sections[0].items[0].kind).toBe("course")
    expect(result.current.sections[0].items[1].kind).toBe("course")
    if (result.current.sections[0].items[0].kind === "course") {
      expect(result.current.sections[0].items[0].entry.course.id).toBe(
        course1.id,
      )
    }
    if (result.current.sections[0].items[1].kind === "course") {
      expect(result.current.sections[0].items[1].entry.course.id).toBe(
        course2.id,
      )
    }
  })

  test("completion counts: completedCount and totalCount are correct", async () => {
    const run = mitxonline.factories.courses.courseRun({ id: 50 })
    const course = mitxonline.factories.courses.course({
      id: 20,
      courseruns: [run],
    })

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const section = reqTree.addOperator({
      operator: "all_of",
      title: "Core Courses",
    })
    section.addCourse({ course: course.id })

    const program = mitxonline.factories.programs.program({
      id: 400,
      courses: [course.id],
      req_tree: reqTree.serialize(),
    })
    const programEnrollment = makeProgramEnrollment(program)
    const courseEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      run: { ...run, course: { id: course.id, title: course.title } },
      grades: [mitxonline.factories.enrollment.grade({ passed: true })],
    })

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programCourses: [course],
      programEnrollments: [programEnrollment],
      courseEnrollments: [courseEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.completedCount).toBe(1)
    expect(result.current.totalCount).toBe(1)
    // per-section counts
    expect(result.current.sections[0].completed).toBe(1)
    expect(result.current.sections[0].total).toBe(1)
  })

  test("programTitle, programType, and programCertificateUrl are derived from program + enrollment", async () => {
    const program = mitxonline.factories.programs.program({
      id: 500,
      title: "Test Program Title",
      program_type: "Professional Certificate",
      courses: [],
    })
    const certLink = "/certificate/program/some-uuid/"
    const programEnrollment = makeProgramEnrollment(program, {
      certificate: { uuid: "some-uuid", link: certLink },
    })

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programEnrollments: [programEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.programTitle).toBe("Test Program Title")
    expect(result.current.programType).toBe("Professional Certificate")
    expect(result.current.programCertificateUrl).toBe(certLink)
  })

  test("programCertificateUrl is null when enrollment has no certificate", async () => {
    const program = mitxonline.factories.programs.program({
      id: 501,
      courses: [],
    })
    const programEnrollment = makeProgramEnrollment(program, {
      certificate: null,
    })

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programEnrollments: [programEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.programCertificateUrl).toBeNull()
  })

  test("enrollmentsByCourseId shared aux is keyed by course id", async () => {
    const run = mitxonline.factories.courses.courseRun({ id: 70 })
    const course = mitxonline.factories.courses.course({
      id: 30,
      courseruns: [run],
    })

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const section = reqTree.addOperator({ operator: "all_of" })
    section.addCourse({ course: course.id })

    const program = mitxonline.factories.programs.program({
      id: 600,
      courses: [course.id],
      req_tree: reqTree.serialize(),
    })
    const programEnrollment = makeProgramEnrollment(program)
    const courseEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      run: { ...run, course: { id: course.id, title: course.title } },
    })

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programCourses: [course],
      programEnrollments: [programEnrollment],
      courseEnrollments: [courseEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.enrollmentsByCourseId[course.id]).toBeDefined()
    expect(result.current.enrollmentsByCourseId[course.id]).toHaveLength(1)
    expect(result.current.enrollmentsByCourseId[course.id][0].id).toBe(
      courseEnrollment.id,
    )
  })

  test("ancestorProgramEnrollment shared aux contains readable_id and enrollment_mode", async () => {
    const program = mitxonline.factories.programs.program({
      id: 700,
      courses: [],
    })
    const programEnrollment = makeProgramEnrollment(program, {
      enrollment_mode: "verified",
    })

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programEnrollments: [programEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.ancestorProgramEnrollment).toBeDefined()
    expect(result.current.ancestorProgramEnrollment?.readable_id).toBe(
      program.readable_id,
    )
    expect(result.current.ancestorProgramEnrollment?.enrollment_mode).toBe(
      "verified",
    )
  })

  test("ancestorProgramEnrollment is undefined when not enrolled", async () => {
    const program = mitxonline.factories.programs.program({
      id: 701,
      courses: [],
    })

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programEnrollments: [],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.ancestorProgramEnrollment).toBeUndefined()
  })

  test("availableLanguages reflects distinct languages across program courses", async () => {
    const englishRun = mitxonline.factories.courses.courseRun({
      language: "en",
    })
    const spanishRun = mitxonline.factories.courses.courseRun({
      language: "es",
    })
    const course = mitxonline.factories.courses.course({
      id: 40,
      courseruns: [englishRun, spanishRun],
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

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const section = reqTree.addOperator({
      operator: "all_of",
      title: "Core",
    })
    section.addCourse({ course: course.id })

    const program = mitxonline.factories.programs.program({
      id: 800,
      courses: [course.id],
      req_tree: reqTree.serialize(),
    })
    const programEnrollment = makeProgramEnrollment(program)

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programCourses: [course],
      programEnrollments: [programEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.availableLanguages).toHaveLength(2)
    const langValues = result.current.availableLanguages.map((o) => o.value)
    expect(langValues).toContain("language:en")
    expect(langValues).toContain("language:es")
  })

  test("selectedLanguageKey defaults to first (alphabetical) option, setSelectedLanguageKey changes it", async () => {
    const englishRun = mitxonline.factories.courses.courseRun({
      language: "en",
    })
    const spanishRun = mitxonline.factories.courses.courseRun({
      language: "es",
    })
    const course = mitxonline.factories.courses.course({
      id: 41,
      courseruns: [englishRun, spanishRun],
      language_options: [
        {
          id: englishRun.id,
          courseware_id: englishRun.courseware_id,
          courseware_url: englishRun.courseware_url ?? "",
          language: "en",
          title: "English Run",
          run_tag: englishRun.run_tag,
        },
        {
          id: spanishRun.id,
          courseware_id: spanishRun.courseware_id,
          courseware_url: spanishRun.courseware_url ?? "",
          language: "es",
          title: "Spanish Run",
          run_tag: spanishRun.run_tag,
        },
      ],
    })

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const section = reqTree.addOperator({ operator: "all_of", title: "Core" })
    section.addCourse({ course: course.id })

    const program = mitxonline.factories.programs.program({
      id: 801,
      courses: [course.id],
      req_tree: reqTree.serialize(),
    })
    const programEnrollment = makeProgramEnrollment(program)

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programCourses: [course],
      programEnrollments: [programEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Options are sorted alphabetically by label; "English" comes before "español"
    expect(result.current.selectedLanguageKey).toBe("language:en")

    // Changing to Spanish updates the key
    act(() => {
      result.current.setSelectedLanguageKey("language:es")
    })
    await waitFor(() =>
      expect(result.current.selectedLanguageKey).toBe("language:es"),
    )
  })

  test("representative displayedEnrollment/displayedRun wiring: enrolled course entry resolves displayed run", async () => {
    const run = mitxonline.factories.courses.courseRun({
      id: 90,
      language: "en",
    })
    const course = mitxonline.factories.courses.course({
      id: 50,
      courseruns: [run],
      next_run_id: run.id,
      language_options: [
        {
          id: run.id,
          courseware_id: run.courseware_id,
          courseware_url: run.courseware_url ?? "",
          language: "en",
          title: run.title,
          run_tag: run.run_tag,
        },
      ],
    })

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const section = reqTree.addOperator({
      operator: "all_of",
      title: "Core Courses",
    })
    section.addCourse({ course: course.id })

    const program = mitxonline.factories.programs.program({
      id: 900,
      courses: [course.id],
      req_tree: reqTree.serialize(),
    })
    const programEnrollment = makeProgramEnrollment(program)
    const courseEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      run: { ...run, course: { id: course.id, title: course.title } },
    })

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programCourses: [course],
      programEnrollments: [programEnrollment],
      courseEnrollments: [courseEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const section0 = result.current.sections[0]
    expect(section0.items[0].kind).toBe("course")
    if (section0.items[0].kind === "course") {
      const entry = section0.items[0].entry
      // enrollments are stored uncollapsed
      expect(entry.enrollments).toHaveLength(1)
      expect(entry.enrollments[0].id).toBe(courseEnrollment.id)
      // displayedEnrollment is wired from the enrollment (enrolled in this language)
      expect(entry.displayedEnrollment).not.toBeNull()
      expect(entry.displayedEnrollment?.id).toBe(courseEnrollment.id)
      // displayedRun resolves to the enrolled run
      expect(entry.displayedRun?.id).toBe(run.id)
    }
  })

  test("language selection changes displayedRun on course entry", async () => {
    const englishRun = mitxonline.factories.courses.courseRun({
      id: 91,
      language: "en",
      is_enrollable: true,
    })
    const spanishRun = mitxonline.factories.courses.courseRun({
      id: 92,
      language: "es",
      is_enrollable: true,
    })
    const course = mitxonline.factories.courses.course({
      id: 51,
      courseruns: [englishRun, spanishRun],
      next_run_id: englishRun.id,
      language_options: [
        {
          id: englishRun.id,
          courseware_id: englishRun.courseware_id,
          courseware_url: englishRun.courseware_url ?? "",
          language: "en",
          title: "English Module",
          run_tag: englishRun.run_tag,
        },
        {
          id: spanishRun.id,
          courseware_id: spanishRun.courseware_id,
          courseware_url: spanishRun.courseware_url ?? "",
          language: "es",
          title: "Spanish Module",
          run_tag: spanishRun.run_tag,
        },
      ],
    })

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const section = reqTree.addOperator({
      operator: "all_of",
      title: "Core Courses",
    })
    section.addCourse({ course: course.id })

    const program = mitxonline.factories.programs.program({
      id: 901,
      courses: [course.id],
      req_tree: reqTree.serialize(),
    })
    const programEnrollment = makeProgramEnrollment(program)

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programCourses: [course],
      programEnrollments: [programEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Default language: English (alphabetically first) → English run
    expect(result.current.selectedLanguageKey).toBe("language:en")
    if (result.current.sections[0].items[0].kind === "course") {
      expect(result.current.sections[0].items[0].entry.displayedRun?.id).toBe(
        englishRun.id,
      )
    }

    // Switch to Spanish → Spanish run
    act(() => {
      result.current.setSelectedLanguageKey("language:es")
    })
    await waitFor(() =>
      expect(result.current.selectedLanguageKey).toBe("language:es"),
    )
    // After key change is confirmed, sections should reflect the Spanish run
    await waitFor(() => {
      const item = result.current.sections[0]?.items[0]
      if (item?.kind === "course") {
        expect(item.entry.displayedRun?.id).toBe(spanishRun.id)
      }
    })
  })

  test("program-as-course arm is correctly identified in sections", async () => {
    const parentReqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const requirements = parentReqTree.addOperator({
      operator: "all_of",
      title: "Requirements",
    })
    requirements.addProgram({ program: 900 })

    const programAsCourse = mitxonline.factories.programs.program({
      id: 900,
      display_mode: "course",
      courses: [11, 12],
    })

    const parentProgram = mitxonline.factories.programs.program({
      id: 1000,
      courses: [],
      req_tree: parentReqTree.serialize(),
    })
    const parentProgramEnrollment = makeProgramEnrollment(parentProgram)

    const moduleCourse1 = mitxonline.factories.courses.course({ id: 11 })
    const moduleCourse2 = mitxonline.factories.courses.course({ id: 12 })

    const { mockAll } = buildProgramScenario({
      programId: parentProgram.id,
      program: parentProgram,
      programEnrollments: [parentProgramEnrollment],
      requiredPrograms: [programAsCourse],
      requiredProgramCourses: [moduleCourse1, moduleCourse2],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(parentProgram.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.sections).toHaveLength(1)
    const item = result.current.sections[0].items[0]
    expect(item.kind).toBe("program-as-course")
    if (item.kind === "program-as-course") {
      expect(item.courseProgram.id).toBe(900)
      expect(item.moduleCourses).toHaveLength(2)
    }
  })

  test("program-enrollment arm is correctly identified in sections", async () => {
    const parentReqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const requirements = parentReqTree.addOperator({
      operator: "all_of",
      title: "Requirements",
    })
    requirements.addProgram({ program: 901 })

    // Not display_mode=course, with a user enrollment in it → program-enrollment
    // arm. Only `id` is under test; this arm reads neither courses nor req_tree
    // of a required program, so no other overrides.
    const requiredProgram = mitxonline.factories.programs.program({
      id: 901,
    })

    const parentProgram = mitxonline.factories.programs.program({
      id: 1001,
      courses: [],
      req_tree: parentReqTree.serialize(),
    })
    const parentProgramEnrollment = makeProgramEnrollment(parentProgram)
    const requiredProgramEnrollment = makeProgramEnrollment(requiredProgram)

    const { mockAll } = buildProgramScenario({
      programId: parentProgram.id,
      program: parentProgram,
      programEnrollments: [parentProgramEnrollment, requiredProgramEnrollment],
      requiredPrograms: [requiredProgram],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(parentProgram.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.sections).toHaveLength(1)
    const item = result.current.sections[0].items[0]
    expect(item.kind).toBe("program-enrollment")
    if (item.kind === "program-enrollment") {
      expect(item.enrollment.program.id).toBe(901)
    }
  })

  test("sections with no resolved items are filtered out", async () => {
    // Two sections: one with a real course, one with a course not in programCourses
    const course = mitxonline.factories.courses.course({ id: 60 })

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const realSection = reqTree.addOperator({
      operator: "all_of",
      title: "Real Section",
    })
    realSection.addCourse({ course: course.id })
    const emptySection = reqTree.addOperator({
      operator: "all_of",
      title: "Empty Section",
    })
    emptySection.addCourse({ course: 9999 }) // not in programCourses

    const program = mitxonline.factories.programs.program({
      id: 1100,
      courses: [course.id],
      req_tree: reqTree.serialize(),
    })
    const programEnrollment = makeProgramEnrollment(program)

    const { mockAll } = buildProgramScenario({
      programId: program.id,
      program,
      programCourses: [course],
      programEnrollments: [programEnrollment],
    })
    mockAll()

    const { result } = renderUseProgramDashboardData(program.id)
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // The empty section should be filtered out
    expect(result.current.sections).toHaveLength(1)
    expect(result.current.sections[0].title).toBe("Real Section")
  })
})
