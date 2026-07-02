import React from "react"
import { renderHook, waitFor, setMockResponse } from "@/test-utils"
import { QueryClientProvider } from "@tanstack/react-query"
import { makeBrowserQueryClient } from "@/app/getQueryClient"
import * as mitxonline from "api/mitxonline-test-utils"
import { useHomeDashboardData } from "./useHomeDashboardData"
import { setupEnrollments } from "../test-utils"

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = makeBrowserQueryClient({ maxRetries: 0 })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const renderUseHomeDashboardData = () =>
  renderHook(() => useHomeDashboardData(), { wrapper })

/**
 * These assert the composer's durable returned contract (ordering,
 * initiallyVisibleCount, B2B exclusion, grouping, isLoading) — not the legacy
 * card shape. `c.type` is used only for TS narrowing to read a durable id;
 * see the durable-contract assertion rule in dashboardRefactorPlan.md.
 */
describe("useHomeDashboardData", () => {
  test("composes buckets into one ordered card list with expired last", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)
    const { enrollments, expired } = setupEnrollments(true)
    setMockResponse.get(
      mitxonline.urls.enrollment.enrollmentsListV3(),
      enrollments,
    )
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )

    const { result } = renderUseHomeDashboardData()

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // 1 completed + 2 started + 2 notStarted (non-expired) then 2 expired
    expect(result.current.cards).toHaveLength(7)
    expect(result.current.initiallyVisibleCount).toBe(5)

    const expiredIds = new Set(expired.map((e) => e.id))
    const visible = result.current.cards.slice(
      0,
      result.current.initiallyVisibleCount,
    )
    const hidden = result.current.cards.slice(
      result.current.initiallyVisibleCount,
    )
    expect(
      visible.some(
        (c) => c.type === "courserun-enrollment" && expiredIds.has(c.data.id),
      ),
    ).toBe(false)
    expect(
      hidden.every(
        (c) => c.type === "courserun-enrollment" && expiredIds.has(c.data.id),
      ),
    ).toBe(true)
  })

  test("excludes B2B course enrollments from the card list and enrollmentsByCourseId lookup", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const b2bEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: 42,
    })
    const personalEnrollment = mitxonline.factories.enrollment.courseEnrollment(
      { b2b_contract_id: null },
    )
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
      b2bEnrollment,
      personalEnrollment,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )

    const { result } = renderUseHomeDashboardData()

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const courseRunIds = result.current.cards.flatMap((c) =>
      c.type === "courserun-enrollment" ? [c.data.id] : [],
    )
    expect(courseRunIds).toContain(personalEnrollment.id)
    expect(courseRunIds).not.toContain(b2bEnrollment.id)

    // B2B enrollments must also be absent from the sibling/module lookup so
    // they don't leak into a personal card's accordion or program modules.
    expect(
      result.current.enrollmentsByCourseId[personalEnrollment.run.course.id],
    ).toEqual([personalEnrollment])
    expect(
      result.current.enrollmentsByCourseId[b2bEnrollment.run.course.id],
    ).toBeUndefined()
  })

  test("groups course-run enrollments by course id for the renderer", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const enrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
    })
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
      enrollment,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )

    const { result } = renderUseHomeDashboardData()

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(
      result.current.enrollmentsByCourseId[enrollment.run.course.id],
    ).toEqual([enrollment])
  })

  test("reports loading until queries resolve", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )

    const { result } = renderUseHomeDashboardData()

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.cards).toEqual([])
    expect(result.current.initiallyVisibleCount).toBe(0)
  })

  test("deduplicates same-variant enrollments for a course to one card", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const courseId = 99
    const enrollmentA = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: {
        course: { id: courseId },
        language: undefined,
        variant_industry: undefined,
        variant_length: undefined,
      },
      certificate: null,
      grades: [],
    })
    const enrollmentB = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: {
        course: { id: courseId },
        language: undefined,
        variant_industry: undefined,
        variant_length: undefined,
      },
      certificate: null,
      grades: [],
    })
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
      enrollmentA,
      enrollmentB,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )

    const { result } = renderUseHomeDashboardData()
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const courseCards = result.current.cards.filter(
      (c) => c.type === "courserun-enrollment",
    )
    expect(courseCards).toHaveLength(1)
  })

  test("keeps enrollments for different variants of the same course as separate cards", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const courseId = 99
    const englishEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: {
        course: { id: courseId },
        language: "en",
        variant_industry: undefined,
        variant_length: undefined,
      },
      certificate: null,
      grades: [],
    })
    const germanEnrollment = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: {
        course: { id: courseId },
        language: "de",
        variant_industry: undefined,
        variant_length: undefined,
      },
      certificate: null,
      grades: [],
    })
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
      englishEnrollment,
      germanEnrollment,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )

    const { result } = renderUseHomeDashboardData()
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const courseCards = result.current.cards.filter(
      (c) => c.type === "courserun-enrollment",
    )
    expect(courseCards).toHaveLength(2)
  })

  test("enrollmentsByCourseId contains all enrollments including non-displayed siblings", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const courseId = 99
    const enrollmentA = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: { course: { id: courseId } },
      certificate: null,
      grades: [],
    })
    const enrollmentB = mitxonline.factories.enrollment.courseEnrollment({
      b2b_contract_id: null,
      run: { course: { id: courseId } },
      certificate: null,
      grades: [],
    })
    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [
      enrollmentA,
      enrollmentB,
    ])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [],
    )

    const { result } = renderUseHomeDashboardData()
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // enrollmentsByCourseId has both; cards has only one (deduped)
    expect(result.current.enrollmentsByCourseId[courseId]).toHaveLength(2)
    expect(
      result.current.cards.filter((c) => c.type === "courserun-enrollment"),
    ).toHaveLength(1)
  })

  test("exposes program-as-course lookups (courseProgramsById, moduleCoursesByProgramId)", async () => {
    const mitxOnlineUser = mitxonline.factories.user.user()
    setMockResponse.get(mitxonline.urls.userMe.get(), mitxOnlineUser)

    const reqTree =
      new mitxonline.factories.requirements.RequirementTreeBuilder()
    const moduleSection = reqTree.addOperator({ operator: "all_of" })
    moduleSection.addCourse({ course: 11 })
    moduleSection.addCourse({ course: 12 })

    const programAsCourse = mitxonline.factories.programs.program({
      id: 555,
      display_mode: "course",
      courses: [11, 12],
      req_tree: reqTree.serialize(),
    })
    const programAsCourseEnrollment =
      mitxonline.factories.enrollment.programEnrollmentV3({
        program: { id: programAsCourse.id },
      })
    const moduleCourses = {
      count: 2,
      next: null,
      previous: null,
      results: [
        mitxonline.factories.courses.course({ id: 11 }),
        mitxonline.factories.courses.course({ id: 12 }),
      ],
    }

    setMockResponse.get(mitxonline.urls.enrollment.enrollmentsListV3(), [])
    setMockResponse.get(
      mitxonline.urls.programEnrollments.enrollmentsListV3(),
      [programAsCourseEnrollment],
    )
    setMockResponse.get(
      mitxonline.urls.programs.programsList({
        id: [programAsCourse.id],
        page_size: 1,
      }),
      { count: 1, next: null, previous: null, results: [programAsCourse] },
    )
    setMockResponse.get(
      mitxonline.urls.courses.coursesList({
        id: programAsCourse.courses,
        page_size: programAsCourse.courses.length,
      }),
      moduleCourses,
    )

    const { result } = renderUseHomeDashboardData()

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.courseProgramsById.get(555)?.id).toBe(555)
    expect(
      result.current.moduleCoursesByProgramId[555].map((c) => c.id),
    ).toEqual([11, 12])
  })
})
