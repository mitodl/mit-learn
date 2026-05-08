import { factories } from "api/mitxonline-test-utils"
import {
  adaptCourseSlotToLegacyDashboardCardProps,
  type LegacyDashboardCardAdapterOutput,
} from "./dashboardAdapters"
import {
  pickDisplayedEnrollmentForLegacyDashboard,
  type DashboardCourseSlot,
} from "./dashboardViewModel"

const makeSlot = (
  overrides: Partial<DashboardCourseSlot>,
): DashboardCourseSlot => {
  const defaultRun = factories.courses.courseRun({
    id: 1,
    courseware_url: "/courseware/default-run/",
  })
  const defaultCourse = factories.courses.course({
    id: 10,
    courseruns: [defaultRun],
  })

  return {
    course: defaultCourse,
    enrollments: [],
    selectedLanguageKey: "",
    availableLanguages: [],
    displayedEnrollment: null,
    displayedRun: defaultRun,
    ...overrides,
  }
}

const expectEnrollmentResource = (
  adapted: LegacyDashboardCardAdapterOutput,
  runId: number,
) => {
  expect(adapted.resource.type).toBe("courserun-enrollment")
  if (adapted.resource.type !== "courserun-enrollment") {
    throw new Error("expected courserun-enrollment resource")
  }
  expect(adapted.resource.data.run.id).toBe(runId)
}

describe("dashboardAdapters", () => {
  test("no enrollment: adapts to course resource", () => {
    const slot = makeSlot({ displayedEnrollment: null })

    const adapted = adaptCourseSlotToLegacyDashboardCardProps(slot)

    expect(adapted.resource.type).toBe("course")
    expect(adapted.selectedCourseRun?.id).toBe(slot.displayedRun?.id)
    expect(adapted.buttonHref).toBe(slot.displayedRun?.courseware_url)
  })

  test("one enrollment: adapts to enrollment resource", () => {
    const run = factories.courses.courseRun({
      id: 2,
      courseware_url: "/courseware/enrolled/",
    })
    const course = factories.courses.course({ id: 20, courseruns: [run] })
    const enrollment = factories.enrollment.courseEnrollment({ run })

    const slot = makeSlot({
      course,
      enrollments: [enrollment],
      displayedEnrollment: enrollment,
      displayedRun: run,
    })
    const adapted = adaptCourseSlotToLegacyDashboardCardProps(slot)

    expectEnrollmentResource(adapted, run.id)
    expect(adapted.buttonHref).toBe(run.courseware_url)
  })

  test("multiple enrollments with certificate: adapter uses policy-selected enrollment", () => {
    const run = factories.courses.courseRun({ id: 3 })
    const course = factories.courses.course({ id: 30, courseruns: [run] })
    const noCertificate = factories.enrollment.courseEnrollment({
      run: { id: 3 },
      certificate: null,
    })
    const withCertificate = factories.enrollment.courseEnrollment({
      run: { id: 3 },
      certificate: { uuid: "cert-3" },
    })

    const displayedEnrollment = pickDisplayedEnrollmentForLegacyDashboard(
      course,
      [noCertificate, withCertificate],
    )
    const slot = makeSlot({
      course,
      enrollments: [noCertificate, withCertificate],
      displayedEnrollment,
      displayedRun: run,
    })
    const adapted = adaptCourseSlotToLegacyDashboardCardProps(slot)

    expectEnrollmentResource(adapted, withCertificate.run.id)
  })

  test("multiple enrollments highest grade: adapter uses policy-selected enrollment", () => {
    const run = factories.courses.courseRun({ id: 4 })
    const course = factories.courses.course({ id: 40, courseruns: [run] })
    const lowGrade = factories.enrollment.courseEnrollment({
      run: { id: 4 },
      certificate: null,
      grades: [factories.enrollment.grade({ grade: 0.5 })],
    })
    const highGrade = factories.enrollment.courseEnrollment({
      run: { id: 4 },
      certificate: null,
      grades: [factories.enrollment.grade({ grade: 0.95 })],
    })

    const displayedEnrollment = pickDisplayedEnrollmentForLegacyDashboard(
      course,
      [lowGrade, highGrade],
    )
    const slot = makeSlot({
      course,
      enrollments: [lowGrade, highGrade],
      displayedEnrollment,
      displayedRun: run,
    })
    const adapted = adaptCourseSlotToLegacyDashboardCardProps(slot)

    expectEnrollmentResource(adapted, highGrade.run.id)
  })

  test("selected-language enrollment: adapter prefers selected enrollment", () => {
    const enRun = factories.courses.courseRun({
      id: 5,
      language: "en",
      courseware_url: "/courseware/en/",
    })
    const esRun = factories.courses.courseRun({
      id: 6,
      language: "es",
      courseware_url: "/courseware/es/",
    })
    const course = factories.courses.course({
      id: 50,
      courseruns: [enRun, esRun],
    })
    const selectedLanguageEnrollment = factories.enrollment.courseEnrollment({
      run: esRun,
    })

    const slot = makeSlot({
      course,
      enrollments: [selectedLanguageEnrollment],
      selectedLanguageKey: "language:es",
      displayedEnrollment: selectedLanguageEnrollment,
      displayedRun: esRun,
    })
    const adapted = adaptCourseSlotToLegacyDashboardCardProps(slot)

    expectEnrollmentResource(adapted, esRun.id)
    expect(adapted.buttonHref).toBe(esRun.courseware_url)
  })

  test("contract-scoped selected-language enrollment: passes contract/program context", () => {
    const run = factories.courses.courseRun({
      id: 7,
      courseware_url: "/courseware/contract-es/",
    })
    const course = factories.courses.course({ id: 60, courseruns: [run] })
    const contractEnrollment = factories.enrollment.courseEnrollment({
      run,
      b2b_contract_id: 999,
    })
    const programEnrollment = factories.enrollment.programEnrollmentV3()

    const slot = makeSlot({
      course,
      enrollments: [contractEnrollment],
      selectedLanguageKey: "language:es",
      displayedEnrollment: contractEnrollment,
      displayedRun: run,
      contractId: 999,
      ancestorContext: { programEnrollment },
    })
    const adapted = adaptCourseSlotToLegacyDashboardCardProps(slot)

    expectEnrollmentResource(adapted, run.id)
    expect(adapted.contractId).toBe(999)
    expect(adapted.programEnrollment).toEqual(programEnrollment)
  })
})
