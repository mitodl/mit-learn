import React from "react"
import {
  renderHook,
  waitFor,
  setMockResponse,
  setupLocationMock,
} from "@/test-utils"
import { QueryClientProvider } from "@tanstack/react-query"
import { makeBrowserQueryClient } from "@/app/getQueryClient"
import { makeRequest, urls, factories } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import { useCourseEnrollment } from "./useCourseEnrollment"
import { getSelectedRun } from "./courseRun"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"
import { trackCourseEnrolled } from "@/common/analytics/gtm"

jest.mock("@/common/analytics/gtm", () => ({
  trackCourseEnrolled: jest.fn(),
}))

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  usePostHog: jest.fn(),
}))
const mockCapture = jest.fn()
jest.mocked(usePostHog).mockReturnValue(
  // @ts-expect-error Not mocking all of posthog
  { capture: mockCapture },
)

const mockPush = jest.fn()
jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

const makeCourse = mitxFactories.courses.course
const makeRun = mitxFactories.courses.courseRun
const makeMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product
const makeUser = factories.user.user

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = makeBrowserQueryClient({ maxRetries: 0 })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useCourseEnrollment — state mapping", () => {
  beforeEach(() => {
    // Most tests use an authenticated user with no enrollments
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), [])
  })

  test("both -> [Earn Certificate, Start Learning]", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: true,
      is_archived: false,
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct()],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    const { result } = renderHook(
      () => useCourseEnrollment(course, getSelectedRun(course)),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    expect(state.status).toBe("options")
    expect(
      state.status === "options" && state.options.map((o) => o.label),
    ).toEqual(["Earn Certificate", "Start Learning"])
    expect(
      state.status === "options" && state.options.map((o) => o.kind),
    ).toEqual(["paid", "free"])
  })

  test("paidOnly -> [Enroll]", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: true,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct()],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    const { result } = renderHook(
      () => useCourseEnrollment(course, getSelectedRun(course)),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    expect(state.status).toBe("options")
    expect(
      state.status === "options" && state.options.map((o) => o.label),
    ).toEqual(["Enroll"])
    expect(
      state.status === "options" && state.options.map((o) => o.kind),
    ).toEqual(["paid"])
  })

  test("freeOnly -> [Start Learning]", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: false,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    const { result } = renderHook(
      () => useCourseEnrollment(course, getSelectedRun(course)),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    expect(state.status).toBe("options")
    expect(
      state.status === "options" && state.options.map((o) => o.label),
    ).toEqual(["Start Learning"])
    expect(
      state.status === "options" && state.options.map((o) => o.kind),
    ).toEqual(["free"])
  })

  test("deadlinePassed -> [Start Learning]", async () => {
    // paid-only but not purchasable (is_upgradable=false) with a free mode too
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: false,
      is_archived: false,
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct()],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    const { result } = renderHook(
      () => useCourseEnrollment(course, getSelectedRun(course)),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    expect(result.current.scenario).toBe("deadlinePassed")
    const state = result.current.state
    expect(state.status).toBe("options")
    expect(
      state.status === "options" && state.options.map((o) => o.label),
    ).toEqual(["Start Learning"])
  })

  test("archived -> [Access Course Materials]", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: true,
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    const { result } = renderHook(
      () => useCourseEnrollment(course, getSelectedRun(course)),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    expect(state.status).toBe("options")
    expect(
      state.status === "options" && state.options.map((o) => o.label),
    ).toEqual(["Access Course Materials"])
    expect(
      state.status === "options" && state.options.map((o) => o.kind),
    ).toEqual(["access"])
  })

  test("none -> {status:'none'}", async () => {
    const { result } = renderHook(
      () => useCourseEnrollment(makeCourse({ courseruns: [] }), undefined),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    expect(result.current.state).toEqual({ status: "none" })
  })
})

describe("useCourseEnrollment — enrolled precedence", () => {
  test("enrolled run -> {status:'enrolled', href:DASHBOARD_HOME} even if archived", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: true,
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })
    const enrollment = mitxFactories.enrollment.courseEnrollment({
      run: { id: run.id },
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), [enrollment])

    const { result } = renderHook(() => useCourseEnrollment(course, run), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    expect(result.current.state.status).toBe("enrolled")
    expect(
      result.current.state.status === "enrolled" && result.current.state.href,
    ).toBe("/dashboard")
  })

  test("enrolled run -> {status:'enrolled'} even if deadlinePassed", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: false,
      is_archived: false,
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct()],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })
    const enrollment = mitxFactories.enrollment.courseEnrollment({
      run: { id: run.id },
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), [enrollment])

    const { result } = renderHook(() => useCourseEnrollment(course, run), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    expect(result.current.scenario).toBe("deadlinePassed")
    expect(result.current.state.status).toBe("enrolled")
  })
})

describe("useCourseEnrollment — auth gating", () => {
  test("anonymous user: enrollments list is never requested, state is scenario options", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: false,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )
    // No mock for enrollmentsListV3 — it must NOT be requested

    const { result } = renderHook(
      () => useCourseEnrollment(course, getSelectedRun(course)),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/api/v3/enrollments/"),
      }),
    )
    // Anonymous user sees freeOnly options
    expect(result.current.state.status).toBe("options")
  })
})

describe("useCourseEnrollment — error handling", () => {
  test("enrollments 500 error -> isStatusLoading:false, state is anonymous scenario options", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: false,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), null, {
      code: 500,
    })

    const { result } = renderHook(
      () => useCourseEnrollment(course, getSelectedRun(course)),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    // No infinite spinner
    expect(result.current.isStatusLoading).toBe(false)
    // State is the scenario options (not enrolled, not throwing)
    expect(result.current.state.status).toBe("options")
  })
})

describe("useCourseEnrollment — actions", () => {
  setupLocationMock()

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), [])
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
  })

  test("paid action -> basket clear + basket create for run's product id", async () => {
    const product = makeProduct()
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: true,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [product],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    const clearUrl = mitxUrls.baskets.clear()
    const basketUrl = mitxUrls.baskets.createFromProduct(product.id)
    setMockResponse.delete(clearUrl, undefined)
    setMockResponse.post(basketUrl, { id: 1, items: [] })

    const { result } = renderHook(() => useCourseEnrollment(course, run), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    expect(state.status).toBe("options")
    if (state.status !== "options") return

    const paidOption = state.options.find((o) => o.kind === "paid")
    expect(paidOption).toBeDefined()

    const fakeEvent = {
      currentTarget: document.createElement("button"),
    } as React.MouseEvent<HTMLButtonElement>

    paidOption!.onClick!(fakeEvent)

    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "delete", url: clearUrl }),
      ),
    )
    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "post", url: basketUrl }),
    )
  })

  test("free action -> audit POST {run_id} + redirect to dashboard success URL", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: false,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    const enrollUrl = mitxUrls.enrollment.enrollmentsListV1()
    setMockResponse.post(enrollUrl, {})

    const { result } = renderHook(() => useCourseEnrollment(course, run), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    expect(state.status).toBe("options")
    if (state.status !== "options") return

    const freeOption = state.options.find((o) => o.kind === "free")
    expect(freeOption).toBeDefined()

    const fakeEvent = {
      currentTarget: document.createElement("button"),
    } as React.MouseEvent<HTMLButtonElement>

    freeOption!.onClick!(fakeEvent)

    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: enrollUrl,
        }),
      ),
    )

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("/dashboard"),
      ),
    )

    expect(trackCourseEnrolled).toHaveBeenCalledWith(course.title)
  })

  test("unauthenticated click -> onRequireSignup called with anchor button", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: false,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )

    const onRequireSignup = jest.fn()

    const { result } = renderHook(
      () => useCourseEnrollment(course, run, { onRequireSignup }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    expect(state.status).toBe("options")
    if (state.status !== "options") return

    const freeOption = state.options.find((o) => o.kind === "free")
    expect(freeOption).toBeDefined()

    const anchorButton = document.createElement("button")
    const fakeEvent = {
      currentTarget: anchorButton,
    } as React.MouseEvent<HTMLButtonElement>

    freeOption!.onClick!(fakeEvent)

    expect(onRequireSignup).toHaveBeenCalledWith(anchorButton)
  })

  test("fires PostHog cta_clicked on paid action click", async () => {
    const product = makeProduct()
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: true,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [product],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.delete(mitxUrls.baskets.clear(), undefined)
    setMockResponse.post(mitxUrls.baskets.createFromProduct(product.id), {
      id: 1,
      items: [],
    })

    const { result } = renderHook(() => useCourseEnrollment(course, run), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    if (state.status !== "options") return
    const paidOption = state.options.find((o) => o.kind === "paid")!

    const fakeEvent = {
      currentTarget: document.createElement("button"),
    } as React.MouseEvent<HTMLButtonElement>

    paidOption.onClick!(fakeEvent)

    expect(mockCapture).toHaveBeenCalledWith(
      PostHogEvents.CallToActionClicked,
      expect.objectContaining({
        readableId: course.readable_id,
        resourceType: "course",
      }),
    )
  })
})
