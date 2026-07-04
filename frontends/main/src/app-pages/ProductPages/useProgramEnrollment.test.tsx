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
import { useProgramEnrollment } from "./useProgramEnrollment"
import { programView } from "@/common/urls"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"
import { trackCourseEnrolled } from "@/common/analytics/gtm"
import { PlatformEnum } from "api"

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

const makeProgram = mitxFactories.programs.program
const makeMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product
const makeProgramEnrollment = mitxFactories.enrollment.programEnrollmentV3
const makeUser = factories.user.user

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = makeBrowserQueryClient({ maxRetries: 0 })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const fakeClickEvent = () =>
  ({
    currentTarget: document.createElement("button"),
  }) as React.MouseEvent<HTMLButtonElement>

describe("useProgramEnrollment — options", () => {
  beforeEach(() => {
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
  })

  test("paid-only -> one 'paid' option labeled 'Enroll in Program'", async () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "100" })],
    })

    const { result } = renderHook(() => useProgramEnrollment(program), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    expect(state.status).toBe("options")
    expect(state.status === "options" && state.options).toEqual([
      expect.objectContaining({ kind: "paid", label: "Enroll in Program" }),
    ])
  })

  test("displayAsCourse paid-only -> label 'Enroll'", async () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "100" })],
    })

    const { result } = renderHook(
      () =>
        useProgramEnrollment(program, {
          tracking: { placement: "infobox" },
          displayAsCourse: true,
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    expect(
      state.status === "options" && state.options.map((o) => o.label),
    ).toEqual(["Enroll"])
  })

  test("both -> [Earn Certificate, Start Learning]", async () => {
    const program = makeProgram({
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct({ price: "100" })],
    })

    const { result } = renderHook(() => useProgramEnrollment(program), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    expect(state.status === "options" && state.options).toEqual([
      expect.objectContaining({ kind: "paid", label: "Earn Certificate" }),
      expect.objectContaining({ kind: "free", label: "Start Learning" }),
    ])
  })

  test("free-only -> one 'free' option labeled 'Start Learning'", async () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })

    const { result } = renderHook(() => useProgramEnrollment(program), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    expect(state.status === "options" && state.options).toEqual([
      expect.objectContaining({ kind: "free", label: "Start Learning" }),
    ])
  })

  test("paid-only without a purchasable product -> {status: 'none'}", async () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [],
    })

    const { result } = renderHook(() => useProgramEnrollment(program), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    expect(result.current.state).toEqual({ status: "none" })
  })
})

describe("useProgramEnrollment — enrolled precedence", () => {
  test("enrolled program -> {status: 'enrolled', href: programView(id)}", async () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    const enrollment = makeProgramEnrollment({ program: { id: program.id } })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [
      enrollment,
    ])

    const { result } = renderHook(() => useProgramEnrollment(program), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    expect(result.current.state).toEqual({
      status: "enrolled",
      href: programView(program.id),
    })
  })
})

describe("useProgramEnrollment — auth gating", () => {
  test("anonymous user: program enrollments list is never requested", async () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })

    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )
    // No mock for programEnrollmentsListV3 — it must NOT be requested

    const { result } = renderHook(() => useProgramEnrollment(program), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    expect(makeRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/api/v3/program_enrollments/"),
      }),
    )
    expect(result.current.state.status).toBe("options")
  })
})

describe("useProgramEnrollment — actions", () => {
  setupLocationMock()

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
  })

  test("fires enroll_cta_clicked with verified mode and resourceType program", async () => {
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])

    const product = makeProduct({ price: "100" })
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [product],
    })
    setMockResponse.delete(mitxUrls.baskets.clear(), undefined)
    setMockResponse.post(mitxUrls.baskets.createFromProduct(product.id), {
      id: 1,
      items: [],
    })

    const { result } = renderHook(
      () =>
        useProgramEnrollment(program, { tracking: { placement: "infobox" } }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    if (state.status !== "options") throw new Error("expected options")
    const paid = state.options.find((o) => o.kind === "paid")!

    paid.onClick!(fakeClickEvent())

    expect(mockCapture).toHaveBeenCalledWith(
      PostHogEvents.EnrollCtaClicked,
      expect.objectContaining({
        placement: "infobox",
        enrollmentMode: "verified",
        resourceType: "program",
        readableId: program.readable_id,
        platform: PlatformEnum.Mitxonline,
        label: "Enroll in Program",
      }),
    )
  })

  test("unauthenticated click still fires analytics and calls onRequireSignup", async () => {
    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const onRequireSignup = jest.fn()

    const { result } = renderHook(
      () =>
        useProgramEnrollment(program, {
          tracking: { placement: "header" },
          onRequireSignup,
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    if (state.status !== "options") throw new Error("expected options")
    const free = state.options.find((o) => o.kind === "free")!

    const anchorButton = document.createElement("button")
    free.onClick!({
      currentTarget: anchorButton,
    } as React.MouseEvent<HTMLButtonElement>)

    expect(mockCapture).toHaveBeenCalledWith(
      PostHogEvents.EnrollCtaClicked,
      expect.objectContaining({
        placement: "header",
        enrollmentMode: "audit",
        resourceType: "program",
        readableId: program.readable_id,
      }),
    )
    expect(onRequireSignup).toHaveBeenCalledWith(anchorButton)
  })

  test("free action -> creates program enrollment and redirects to success URL", async () => {
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])

    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    setMockResponse.post(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      null,
      { code: 201 },
    )

    const { result } = renderHook(() => useProgramEnrollment(program), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    if (state.status !== "options") throw new Error("expected options")
    const free = state.options.find((o) => o.kind === "free")!

    free.onClick!(fakeClickEvent())

    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: mitxUrls.programEnrollments.enrollmentsListV3(),
          body: { program_id: program.id },
        }),
      ),
    )

    await waitFor(() =>
      expect(trackCourseEnrolled).toHaveBeenCalledWith(program.title),
    )
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("/dashboard"),
      ),
    )
  })

  test("paid action -> clears basket and adds the program's product", async () => {
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])

    const product = makeProduct({ price: "100" })
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [product],
    })
    const clearUrl = mitxUrls.baskets.clear()
    const basketUrl = mitxUrls.baskets.createFromProduct(product.id)
    setMockResponse.delete(clearUrl, undefined)
    setMockResponse.post(basketUrl, { id: 1, items: [] })

    const { result } = renderHook(() => useProgramEnrollment(program), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    if (state.status !== "options") throw new Error("expected options")
    const paid = state.options.find((o) => o.kind === "paid")!

    paid.onClick!(fakeClickEvent())

    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: "delete", url: clearUrl }),
      ),
    )
    expect(makeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "post", url: basketUrl }),
    )
  })
})
