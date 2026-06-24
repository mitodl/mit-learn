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
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
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
const makeFlexiblePrice = mitxFactories.products.flexiblePrice
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

    // Button and card share the [data-card='cert'] wrapper cell
    const certCell = document.querySelector("[data-card='cert']") as HTMLElement
    expect(certCell).not.toBeNull()
    within(certCell).getByRole("heading", {
      name: "Certificate Track",
      level: 3,
    })
    within(certCell).getByRole("button", { name: "Enroll" })

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

    // Button and card share the [data-card='free'] wrapper cell
    const freeCell = document.querySelector("[data-card='free']") as HTMLElement
    expect(freeCell).not.toBeNull()
    within(freeCell).getByRole("heading", { name: "Learn for Free", level: 3 })
    within(freeCell).getByRole("button", { name: "Start Learning" })

    // Large
    expect(startBtn.closest("[data-size]")).toHaveAttribute(
      "data-size",
      "large",
    )
  })
})

describe("CourseEnrollArea — deadlinePassed scenario", () => {
  test("shows Learn for Free card with Access Course Materials below and the in-card 'Certificate deadline passed' note", async () => {
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
      await screen.findByRole("button", { name: "Access Course Materials" }),
    ).toBeInTheDocument()
    // The cert deadline has passed for a run that offered one, so the in-card
    // note shows — matching the archived scenario and Figma. (The metadata
    // "Certificate deadline has passed." alert in CourseSummary is separate.)
    expect(screen.getByText("Certificate deadline passed")).toBeInTheDocument()
  })
})

describe("CourseEnrollArea — archived scenario", () => {
  test("shows Learn for Free card; Access Course Materials button below; deadline note when the run offered a certificate", async () => {
    setupAuth()
    const run = makeRun({
      is_enrollable: true,
      is_archived: true,
      // offered a paid certificate, so the "deadline passed" note applies
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
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
    // Archived runs are past their certificate window too, so a run that
    // offered a certificate carries the deadline note.
    expect(screen.getByText("Certificate deadline passed")).toBeInTheDocument()
  })

  test("audit-only archived run shows no 'Certificate deadline passed' note (it never offered one)", async () => {
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

    await screen.findByRole("button", { name: "Access Course Materials" })
    expect(screen.queryByText("Certificate deadline passed")).toBeNull()
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
  test("card renders immediately while enrollment-status button is aria-busy and disabled (cards never spin)", async () => {
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: true,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: false })],
      products: [],
    })
    const course = makeCourse({ next_run_id: run.id, courseruns: [run] })

    // Hold the auth response so we can observe the loading state
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

    // Card heading is present immediately (cards never spin)
    const btns = await screen.findAllByRole("button", { hidden: false })
    const busyBtns = btns.filter((b) => b.getAttribute("aria-busy") === "true")
    expect(busyBtns.length).toBeGreaterThan(0)
    busyBtns.forEach((btn) => expect(btn).toBeDisabled())
    // The busy button's label is hidden behind the spinner, so it must still be
    // reachable by an accessible name ("Loading") rather than nameless (WCAG
    // 4.1.2). A regression dropping that aria-label would fail here.
    expect(screen.getByRole("button", { name: "Loading" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Learn for Free", level: 3 }),
    ).toBeInTheDocument()

    // After auth resolves, button gets its label
    await act(async () => {
      resolveMe(makeUser({ is_authenticated: true }))
    })
    setMockResponse.get(mitxUrls.enrollment.enrollmentsListV3(), [])
    await screen.findByRole("button", { name: "Start Learning" })
  })
})

describe("CourseEnrollArea — click smoke tests", () => {
  setupLocationMock()

  test("paid click redirects to cart", async () => {
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
    await act(async () => {
      enrollBtn.click()
    })

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith(
        mitxonlineLegacyUrl("/cart/"),
      )
    })
  })
  // Free-click behavior (audit POST + dashboard redirect) is fully covered by
  // useCourseEnrollment.test.tsx "free action -> audit POST + redirect" test.
})

describe("CourseEnrollArea — financial assistance link", () => {
  test("paidOnly course with financial_assistance_form_url shows 'Financial assistance available' link", async () => {
    setupAuth()
    const product = makeProduct()
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: true,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [product],
    })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
      page: { financial_assistance_form_url: "/financial-aid/" },
    })

    setMockResponse.get(
      mitxUrls.products.userFlexiblePriceDetail(product.id),
      makeFlexiblePrice({ id: product.id, product_flexible_price: null }),
    )

    renderWithProviders(
      <CourseEnrollArea course={course} selectedRun={getSelectedRun(course)} />,
    )

    const link = await screen.findByRole("link", {
      name: "Financial assistance available",
    })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", mitxonlineLegacyUrl("/financial-aid/"))
  })

  test("paidOnly course with approved flexible price shows 'Financial assistance applied' link", async () => {
    setupAuth()
    const product = makeProduct()
    const flexiblePrice = makeFlexiblePrice({
      id: product.id,
      product_flexible_price: {
        id: 1,
        amount: "25.00",
        discount_type: "dollars-off" as const,
        discount_code: "AID",
        redemption_type: "one-time" as const,
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: null,
        expiration_date: null,
      },
    })
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: true,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [product],
    })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
      page: { financial_assistance_form_url: "/financial-aid/" },
    })

    setMockResponse.get(
      mitxUrls.products.userFlexiblePriceDetail(product.id),
      flexiblePrice,
    )

    renderWithProviders(
      <CourseEnrollArea course={course} selectedRun={getSelectedRun(course)} />,
    )

    const link = await screen.findByRole("link", {
      name: "Financial assistance applied",
    })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", mitxonlineLegacyUrl("/financial-aid/"))
  })

  test("paidOnly course with approved flexible price shows discounted final price and struck-through original", async () => {
    // Case C2: course Certificate Track with approved financial aid shows both prices
    setupAuth()
    const product = makeProduct({ price: "100" })
    const flexiblePrice = makeFlexiblePrice({
      id: product.id,
      price: product.price,
      product_flexible_price: {
        id: 1,
        amount: "25.00",
        discount_type: "dollars-off" as const,
        discount_code: "AID",
        redemption_type: "one-time" as const,
        is_redeemed: false,
        automatic: true,
        max_redemptions: 1,
        payment_type: null,
        activation_date: null,
        expiration_date: null,
      },
    })
    const run = makeRun({
      is_enrollable: true,
      is_upgradable: true,
      is_archived: false,
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [product],
    })
    const course = makeCourse({
      next_run_id: run.id,
      courseruns: [run],
      page: { financial_assistance_form_url: "/financial-aid/" },
    })

    setMockResponse.get(
      mitxUrls.products.userFlexiblePriceDetail(product.id),
      flexiblePrice,
    )

    renderWithProviders(
      <CourseEnrollArea course={course} selectedRun={getSelectedRun(course)} />,
    )

    // Final discounted price renders
    expect(await screen.findByText("$75")).toBeInTheDocument()
    // Struck-through original price renders
    expect(screen.getByText("$100")).toBeInTheDocument()
  })
})
