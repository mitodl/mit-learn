import React from "react"
import {
  renderWithProviders,
  screen,
  within,
  waitFor,
  setMockResponse,
  act,
  setupLocationMock,
} from "@/test-utils"
import { factories, urls } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import CourseEnrollArea from "./CourseEnrollArea"
import { getSelectedRun } from "./courseRun"

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  usePostHog: jest.fn(() => ({ capture: jest.fn() })),
}))

jest.mock("@/common/analytics/gtm", () => ({
  trackCourseEnrolled: jest.fn(),
}))

const makeCourse = mitxFactories.courses.course
const makeRun = mitxFactories.courses.courseRun
const makeMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product
const makeUser = factories.user.user

function setupAuth() {
  setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
  setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), [])
}

describe("CourseEnrollArea — both scenario", () => {
  test("shows Choose Your Path heading; paid button inside Certificate Track card; free button inside Learn for Free card; both medium", async () => {
    setupAuth()
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

    renderWithProviders(
      <CourseEnrollArea course={course} selectedRun={getSelectedRun(course)} />,
    )

    expect(await screen.findByText("Choose Your Path")).toBeInTheDocument()

    // Wait for loading to settle (buttons get their labels once isStatusLoading=false)
    const earnBtn = await screen.findByRole("button", {
      name: "Earn Certificate",
    })
    const startBtn = await screen.findByRole("button", {
      name: "Start Learning",
    })
    expect(earnBtn).toBeInTheDocument()
    expect(startBtn).toBeInTheDocument()

    // Paid button INSIDE the Certificate Track card (h3 is deep in card; go up to CardShell)
    const certHeading = screen.getByRole("heading", {
      name: "Certificate Track",
      level: 3,
    })
    // CardShell is two div-levels above: h3 > LeftCol > TopRow > CardBody > CardShell
    const certCard = certHeading.closest("[data-card='cert']") as HTMLElement
    within(certCard).getByRole("button", { name: "Earn Certificate" })

    // Free button INSIDE the Learn for Free card
    const freeHeading = screen.getByRole("heading", {
      name: "Learn for Free",
      level: 3,
    })
    const freeCard = freeHeading.closest("[data-card='free']") as HTMLElement
    within(freeCard).getByRole("button", { name: "Start Learning" })

    // Both buttons are medium size
    expect(earnBtn.closest("[data-size]")).toHaveAttribute(
      "data-size",
      "medium",
    )
    expect(startBtn.closest("[data-size]")).toHaveAttribute(
      "data-size",
      "medium",
    )
  })
})

describe("CourseEnrollArea — paidOnly scenario", () => {
  test("shows Certificate Track card; Enroll button BELOW (not inside) the card; large; no Choose Your Path", async () => {
    setupAuth()
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: true,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct()],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    renderWithProviders(
      <CourseEnrollArea course={course} selectedRun={getSelectedRun(course)} />,
    )

    const enrollBtn = await screen.findByRole("button", { name: "Enroll" })
    expect(enrollBtn).toBeInTheDocument()

    // No Choose Your Path
    expect(screen.queryByText("Choose Your Path")).toBeNull()

    // Button is NOT inside the Certificate Track card (no data-card wrapper in paidOnly)
    const certHeading = screen.getByRole("heading", {
      name: "Certificate Track",
      level: 3,
    })
    // CertificateTrackCard renders CardShell(div) > CardBody(div) > heading deep inside
    // Walk up 4 divs to get to CardShell (h3 < LeftCol < TopRow < CardBody < CardShell)
    const cardShell =
      certHeading.parentElement?.parentElement?.parentElement?.parentElement
    expect(cardShell).toBeDefined()
    expect(
      within(cardShell!).queryByRole("button", { name: "Enroll" }),
    ).toBeNull()

    // Button is large
    expect(enrollBtn.closest("[data-size]")).toHaveAttribute(
      "data-size",
      "large",
    )
  })
})

describe("CourseEnrollArea — freeOnly scenario", () => {
  test("shows Learn for Free card; Start Learning button below; large", async () => {
    setupAuth()
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: false,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    renderWithProviders(
      <CourseEnrollArea course={course} selectedRun={getSelectedRun(course)} />,
    )

    const startBtn = await screen.findByRole("button", {
      name: "Start Learning",
    })
    expect(startBtn).toBeInTheDocument()

    // NOT inside the Learn for Free card
    const freeHeading = screen.getByRole("heading", {
      name: "Learn for Free",
      level: 3,
    })
    // LearnForFreeCard: h3 < LeftCol < TopRow < CardBody < CardShell
    const cardShell =
      freeHeading.parentElement?.parentElement?.parentElement?.parentElement
    expect(cardShell).toBeDefined()
    expect(
      within(cardShell!).queryByRole("button", { name: "Start Learning" }),
    ).toBeNull()

    // Large
    expect(startBtn.closest("[data-size]")).toHaveAttribute(
      "data-size",
      "large",
    )
  })
})

describe("CourseEnrollArea — deadlinePassed scenario", () => {
  test("shows Learn for Free card with deadline note; Start Learning below", async () => {
    setupAuth()
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

    renderWithProviders(
      <CourseEnrollArea course={course} selectedRun={getSelectedRun(course)} />,
    )

    expect(
      await screen.findByText("Certificate deadline has passed."),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: "Start Learning" }),
    ).toBeInTheDocument()
  })
})

describe("CourseEnrollArea — archived scenario", () => {
  test("shows Learn for Free card; Access Course Materials button below", async () => {
    setupAuth()
    const run = makeRun({
      is_enrollable: true,
      is_archived: true,
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    renderWithProviders(
      <CourseEnrollArea course={course} selectedRun={getSelectedRun(course)} />,
    )

    const accessBtn = await screen.findByRole("button", {
      name: "Access Course Materials",
    })
    expect(accessBtn).toBeInTheDocument()
    expect(accessBtn.closest("[data-size]")).toHaveAttribute(
      "data-size",
      "large",
    )
  })
})

describe("CourseEnrollArea — none scenario", () => {
  test("renders nothing when there are no enrollable runs", async () => {
    setupAuth()
    const course = makeCourse({ courseruns: [] })

    renderWithProviders(
      <CourseEnrollArea course={course} selectedRun={undefined} />,
    )

    // Wait for auth to settle
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull())
    expect(screen.queryByRole("heading")).toBeNull()
  })
})

describe("CourseEnrollArea — enrolled scenario", () => {
  test("shows single Enrolled link; no cards; no Choose Your Path", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })
    const enrollment = mitxFactories.enrollment.courseEnrollment({
      run: { id: run.id },
    })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), [enrollment])

    renderWithProviders(<CourseEnrollArea course={course} selectedRun={run} />)

    const enrolledLink = await screen.findByRole("link", { name: /Enrolled/ })
    expect(enrolledLink).toBeInTheDocument()
    expect(enrolledLink).toHaveAttribute("href", "/dashboard")

    expect(screen.queryByText("Choose Your Path")).toBeNull()
    expect(
      screen.queryByRole("heading", { name: "Certificate Track" }),
    ).toBeNull()
    expect(screen.queryByRole("heading", { name: "Learn for Free" })).toBeNull()
  })
})

describe("CourseEnrollArea — loading state", () => {
  test("buttons are disabled and aria-busy while status is loading", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: true,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    // Return a promise that won't resolve immediately so we catch the loading state
    const { promise: mePromise, resolve: resolveMe } = (() => {
      let resolve!: (v: unknown) => void
      const promise = new Promise((r) => {
        resolve = r
      })
      return { promise, resolve }
    })()

    setMockResponse.get(urls.userMe.get(), mePromise)

    renderWithProviders(
      <CourseEnrollArea course={course} selectedRun={getSelectedRun(course)} />,
    )

    // During loading, button(s) should be aria-busy
    const btns = await screen.findAllByRole("button", { hidden: false })
    // At least one button present with aria-busy
    const busyBtns = btns.filter((b) => b.getAttribute("aria-busy") === "true")
    expect(busyBtns.length).toBeGreaterThan(0)
    busyBtns.forEach((btn) => expect(btn).toBeDisabled())

    // After resolving, buttons are no longer busy
    await act(async () => {
      resolveMe(makeUser({ is_authenticated: true }))
    })
    setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), [])
    await waitFor(() => {
      const buttons = screen.queryAllByRole("button")
      const stillBusy = buttons.filter(
        (b) => b.getAttribute("aria-busy") === "true",
      )
      expect(stillBusy).toHaveLength(0)
    })
  })
})

describe("CourseEnrollArea — click smoke tests", () => {
  setupLocationMock()

  test("paid click triggers basket replace", async () => {
    setupAuth()
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

    renderWithProviders(<CourseEnrollArea course={course} selectedRun={run} />)

    const enrollBtn = await screen.findByRole("button", { name: "Enroll" })
    expect(enrollBtn).toBeInTheDocument()
    // Click doesn't throw
    await act(async () => {
      enrollBtn.click()
    })
  })

  test("free click triggers audit enrollment", async () => {
    setupAuth()
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: false,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    setMockResponse.post(mitxUrls.enrollment.enrollmentsListV1(), {})

    renderWithProviders(<CourseEnrollArea course={course} selectedRun={run} />)

    const startBtn = await screen.findByRole("button", {
      name: "Start Learning",
    })
    expect(startBtn).toBeInTheDocument()
    await act(async () => {
      startBtn.click()
    })
  })
})
