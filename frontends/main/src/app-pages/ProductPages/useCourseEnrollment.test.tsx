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
import type { EnrollActionKind } from "./useCourseEnrollment"
import { getSelectedRun } from "./courseRun"
import type { CourseScenario } from "./courseRun"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
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

type StateMappingCase = {
  name: string
  build: () => {
    course: CourseWithCourseRunsSerializerV2
    selectedRun: CourseRunV2 | undefined
  }
  // Asserted only when present — the degraded scenarios additionally pin their
  // CourseScenario union shape.
  scenario?: CourseScenario
  expected: { labels: string[]; kinds: EnrollActionKind[] } | { none: true }
}

// Build a course with a single selected run, active + enrollable by default, so
// each case only spells out the fields that define its offering/status.
const singleRunCourse = (overrides: Parameters<typeof makeRun>[0]) => {
  const run = makeRun({ is_enrollable: true, is_archived: false, ...overrides })
  const course = makeCourse({ next_run_id: run.id, courseruns: [run] })
  return { course, selectedRun: getSelectedRun(course) }
}

const STATE_MAPPING_CASES: StateMappingCase[] = [
  {
    name: "both (free + paid, upgradable) → [Earn Certificate, Start Learning]",
    build: () =>
      singleRunCourse({
        is_upgradable: true,
        enrollment_modes: [
          makeMode({ requires_payment: false }),
          makeMode({ requires_payment: true }),
        ],
        products: [makeProduct()],
      }),
    expected: {
      labels: ["Earn Certificate", "Start Learning"],
      kinds: ["paid", "free"],
    },
  },
  {
    name: "paid only (upgradable) → [Enroll]",
    build: () =>
      singleRunCourse({
        is_upgradable: true,
        enrollment_modes: [makeMode({ requires_payment: true })],
        products: [makeProduct()],
      }),
    expected: { labels: ["Enroll"], kinds: ["paid"] },
  },
  {
    name: "free only → [Start Learning]",
    build: () =>
      singleRunCourse({
        is_upgradable: false,
        enrollment_modes: [makeMode({ requires_payment: false })],
        products: [],
      }),
    expected: { labels: ["Start Learning"], kinds: ["free"] },
  },
  {
    name: "deadline passed, free fallback → [Access Course Materials]",
    build: () =>
      singleRunCourse({
        is_upgradable: false,
        enrollment_modes: [
          makeMode({ requires_payment: false }),
          makeMode({ requires_payment: true }),
        ],
        products: [makeProduct()],
      }),
    scenario: {
      status: "deadlinePassed",
      offering: "free",
      offeredCertificate: true,
    },
    expected: { labels: ["Access Course Materials"], kinds: ["free"] },
  },
  {
    name: "deadline passed, paid only (no free fallback) → no button",
    build: () =>
      singleRunCourse({
        is_upgradable: false,
        enrollment_modes: [makeMode({ requires_payment: true })],
        products: [],
      }),
    scenario: {
      status: "deadlinePassed",
      offering: "none",
      offeredCertificate: true,
    },
    expected: { none: true },
  },
  {
    name: "archived → [Access Course Materials]",
    build: () =>
      singleRunCourse({
        is_archived: true,
        enrollment_modes: [makeMode({ requires_payment: false })],
      }),
    expected: { labels: ["Access Course Materials"], kinds: ["free"] },
  },
  {
    name: "no enrollable runs → no button",
    build: () => ({
      course: makeCourse({ courseruns: [] }),
      selectedRun: undefined,
    }),
    expected: { none: true },
  },
]

describe("useCourseEnrollment — state mapping", () => {
  beforeEach(() => {
    // Most tests use an authenticated user with no enrollments
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), [])
  })

  test.each(STATE_MAPPING_CASES)(
    "$name",
    async ({ build, scenario, expected }) => {
      const { course, selectedRun } = build()

      const { result } = renderHook(
        () => useCourseEnrollment(course, selectedRun),
        { wrapper },
      )

      await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

      if (scenario) {
        expect(result.current.scenario).toEqual(scenario)
      }

      const state = result.current.state
      if ("none" in expected) {
        expect(state).toEqual({ status: "none" })
        return
      }
      expect(state.status).toBe("options")
      expect(
        state.status === "options" && state.options.map((o) => o.label),
      ).toEqual(expected.labels)
      expect(
        state.status === "options" && state.options.map((o) => o.kind),
      ).toEqual(expected.kinds)
    },
  )
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

    expect(result.current.scenario).toEqual({
      status: "deadlinePassed",
      offering: "free",
      offeredCertificate: true,
    })
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

  test("access action (archived) -> audit POST {run_id} + redirect to dashboard success URL", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: true,
      enrollment_modes: [makeMode({ requires_payment: false })],
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

    // The archived "Access Course Materials" action — now kind "free", with the
    // audit label distinguishing it from the active "Start Learning" free path.
    const accessOption = state.options.find(
      (o) => o.label === "Access Course Materials",
    )
    expect(accessOption).toBeDefined()

    const fakeEvent = {
      currentTarget: document.createElement("button"),
    } as React.MouseEvent<HTMLButtonElement>

    accessOption!.onClick!(fakeEvent)

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

  test("fires PostHog enroll_cta_clicked on paid action click", async () => {
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

    const { result } = renderHook(
      () => useCourseEnrollment(course, run, { placement: "infobox" }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    if (state.status !== "options") return
    const paidOption = state.options.find((o) => o.kind === "paid")!

    const fakeEvent = {
      currentTarget: document.createElement("button"),
    } as React.MouseEvent<HTMLButtonElement>

    paidOption.onClick!(fakeEvent)

    expect(mockCapture).toHaveBeenCalledWith(
      PostHogEvents.EnrollCtaClicked,
      expect.objectContaining({
        placement: "infobox",
        enrollment_mode: "verified",
        resource_type: "course",
        readable_id: course.readable_id,
      }),
    )
  })

  test("fires PostHog enroll_cta_clicked with audit mode on free action click", async () => {
    // Unauthenticated: the event fires before the auth gate, then we return to
    // the signup flow — so the fire is observable without an enrollment mock.
    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: false,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    const { result } = renderHook(
      () => useCourseEnrollment(course, run, { placement: "header" }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    if (state.status !== "options") return
    const freeOption = state.options.find((o) => o.kind === "free")!

    freeOption.onClick!({
      currentTarget: document.createElement("button"),
    } as React.MouseEvent<HTMLButtonElement>)

    expect(mockCapture).toHaveBeenCalledWith(
      PostHogEvents.EnrollCtaClicked,
      expect.objectContaining({
        placement: "header",
        enrollment_mode: "audit",
        resource_type: "course",
        readable_id: course.readable_id,
      }),
    )
  })
})
