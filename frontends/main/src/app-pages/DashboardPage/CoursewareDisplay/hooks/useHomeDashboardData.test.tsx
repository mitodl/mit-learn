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

  test("excludes B2B course enrollments from the card list", async () => {
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
})
