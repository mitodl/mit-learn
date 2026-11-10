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
  mockEnrollmentEligible,
} from "api/mitxonline-test-utils"
import { useProgramEnrollment } from "./useProgramEnrollment"
import { programView } from "@/common/urls"
import { PostHogEvents } from "@/common/constants"
import { trackProgramEnrolled } from "@/common/analytics/gtm"
import { capturePostHog } from "@/common/analytics/posthog"
import {
  lastAuthRedirect,
  rememberClick,
  setLocation,
} from "./test-utils/enrollResume"
import { PlatformEnum } from "api"

// The paid path checks enrollment eligibility before the cart.
beforeEach(() => {
  mockEnrollmentEligible()
})

jest.mock("@/common/analytics/gtm", () => ({
  trackProgramEnrolled: jest.fn(),
}))

jest.mock("@/common/analytics/posthog", () => ({
  capturePostHog: jest.fn(),
  initPostHog: jest.fn(),
}))
const mockCapturePostHog = jest.mocked(capturePostHog)

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
    // Enrolling now consults the MITx Online profile through the compliance
    // gate. The factory default has nothing missing, so it passes straight
    // through; see JustInTimeDialog tests for the blocked case.
    setMockResponse.get(mitxUrls.userMe.get(), mitxFactories.user.user())
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

    expect(mockCapturePostHog).toHaveBeenCalledWith(
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

  test("unauthenticated click fires analytics and goes to login, returning to finish", async () => {
    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct()],
    })
    setLocation("/programs/some-program")

    const { result } = renderHook(
      () =>
        useProgramEnrollment(program, {
          tracking: { placement: "header" },
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))

    const state = result.current.state
    if (state.status !== "options") throw new Error("expected options")
    state.options.find((o) => o.kind === "paid")!.onClick!(fakeClickEvent())

    expect(mockCapturePostHog).toHaveBeenCalledWith(
      PostHogEvents.EnrollCtaClicked,
      expect.objectContaining({
        placement: "header",
        resourceType: "program",
        readableId: program.readable_id,
      }),
    )
    const { url, next, signupNext } = lastAuthRedirect()
    expect(next.pathname).toBe("/programs/some-program")
    expect(Object.fromEntries(next.searchParams)).toEqual({ enroll: "paid" })
    expect(signupNext.href).toBe(next.href)
    expect(url.searchParams.get("skip_onboarding")).toBe("1")
  })

  test("resuming a paid marker puts the program in the basket once", async () => {
    const replaceState = jest
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {})
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    const product = makeProduct()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [product],
    })
    setMockResponse.delete(mitxUrls.baskets.clear(), undefined)
    setMockResponse.post(mitxUrls.baskets.createFromProduct(product.id), {
      id: 1,
      items: [],
    })
    setLocation("/programs/some-program?enroll=paid")
    rememberClick("paid", null, "/programs/some-program")

    renderHook(
      () =>
        useProgramEnrollment(program, {
          tracking: { placement: "infobox" },
          resume: true,
        }),
      { wrapper },
    )

    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: mitxUrls.baskets.createFromProduct(product.id),
        }),
      ),
    )
    const basketCreates = jest
      .mocked(makeRequest)
      .mock.calls.filter(
        ([req]) =>
          req.method === "post" &&
          req.url === mitxUrls.baskets.createFromProduct(product.id),
      )
    expect(basketCreates).toHaveLength(1)
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(new URL(String(replaceState.mock.calls[0][2])).search).toBe("")
    replaceState.mockRestore()
  })
  test("resuming waits for a failed enrollments lookup to succeed", async () => {
    const replaceState = jest
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {})
    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), null, {
      code: 500,
    })
    const product = makeProduct()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [product],
    })
    setMockResponse.delete(mitxUrls.baskets.clear(), undefined)
    setMockResponse.post(mitxUrls.baskets.createFromProduct(product.id), {
      id: 1,
      items: [],
    })
    setLocation("/programs/some-program?enroll=paid")
    rememberClick("paid", null, "/programs/some-program")
    const queryClient = makeBrowserQueryClient({ maxRetries: 0 })

    const { result } = renderHook(
      () =>
        useProgramEnrollment(program, {
          tracking: { placement: "infobox" },
          resume: true,
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      },
    )

    await waitFor(() => expect(result.current.isStatusLoading).toBe(false))
    expect(replaceState).not.toHaveBeenCalled()

    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    await queryClient.refetchQueries()

    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: mitxUrls.baskets.createFromProduct(product.id),
        }),
      ),
    )
    expect(replaceState).toHaveBeenCalledTimes(1)
    replaceState.mockRestore()
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
      expect(trackProgramEnrolled).toHaveBeenCalledWith(program.title),
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
