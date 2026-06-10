import { factories } from "api/mitxonline-test-utils"
import { LanguageEnum } from "@mitodl/mitxonline-api-axios/v2"
import {
  adaptCourseEntryToLegacyDashboardCardProps,
  type LegacyDashboardCardAdapterOutput,
} from "./dashboardAdapters"
import {
  pickDisplayedEnrollmentForLegacyDashboard,
  type DashboardCourseEntry,
} from "./dashboardViewModel"

const makeEntry = (
  overrides: Partial<DashboardCourseEntry>,
): DashboardCourseEntry => {
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
    const entry = makeEntry({ displayedEnrollment: null })

    const adapted = adaptCourseEntryToLegacyDashboardCardProps(entry)

    expect(adapted.resource.type).toBe("course")
    expect(adapted.selectedCourseRun?.id).toBe(entry.displayedRun?.id)
    expect(adapted.buttonHref).toBe(entry.displayedRun?.courseware_url)
  })

  test("one enrollment: adapts to enrollment resource", () => {
    const run = factories.courses.courseRun({
      id: 2,
      courseware_url: "/courseware/enrolled/",
    })
    const course = factories.courses.course({ id: 20, courseruns: [run] })
    const enrollment = factories.enrollment.courseEnrollment({ run })

    const entry = makeEntry({
      course,
      enrollments: [enrollment],
      displayedEnrollment: enrollment,
      displayedRun: run,
    })
    const adapted = adaptCourseEntryToLegacyDashboardCardProps(entry)

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
    const entry = makeEntry({
      course,
      enrollments: [noCertificate, withCertificate],
      displayedEnrollment,
      displayedRun: run,
    })
    const adapted = adaptCourseEntryToLegacyDashboardCardProps(entry)

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
    const entry = makeEntry({
      course,
      enrollments: [lowGrade, highGrade],
      displayedEnrollment,
      displayedRun: run,
    })
    const adapted = adaptCourseEntryToLegacyDashboardCardProps(entry)

    expectEnrollmentResource(adapted, highGrade.run.id)
  })

  test("selected-language enrollment: adapter prefers selected enrollment", () => {
    const enRun = factories.courses.courseRun({
      id: 5,
      language: LanguageEnum.En,
      courseware_url: "/courseware/en/",
    })
    const esRun = factories.courses.courseRun({
      id: 6,
      language: LanguageEnum.EsEs,
      courseware_url: "/courseware/es/",
    })
    const course = factories.courses.course({
      id: 50,
      courseruns: [enRun, esRun],
    })
    const selectedLanguageEnrollment = factories.enrollment.courseEnrollment({
      run: esRun,
    })

    const entry = makeEntry({
      course,
      enrollments: [selectedLanguageEnrollment],
      displayedEnrollment: selectedLanguageEnrollment,
      displayedRun: esRun,
    })
    const adapted = adaptCourseEntryToLegacyDashboardCardProps(entry)

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
    const parentProgramReadableIds = ["program-v1:MITx+TestProgram"]

    const entry = makeEntry({
      course,
      enrollments: [contractEnrollment],
      displayedEnrollment: contractEnrollment,
      displayedRun: run,
      contractId: 999,
      ancestorContext: { programEnrollment, parentProgramReadableIds },
    })
    const adapted = adaptCourseEntryToLegacyDashboardCardProps(entry)

    expectEnrollmentResource(adapted, run.id)
    expect(adapted.contractId).toBe(999)
    expect(adapted.programEnrollment).toEqual(programEnrollment)
    expect(adapted.parentProgramReadableIds).toEqual(parentProgramReadableIds)
  })
})
