import React from "react"
import {
  renderWithProviders,
  screen,
  within,
  waitFor,
  setMockResponse,
} from "@/test-utils"
import { factories, makeRequest, urls } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import {
  DiscountTypeEnum,
  PaymentTypeEnum,
} from "@mitodl/mitxonline-api-axios/v2"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
import { programView } from "@/common/urls"
import ProgramEnrollArea from "./ProgramEnrollArea"
import { makeProgram, setupUserPricing } from "./test-utils/userPricing"

jest.mock("next-nprogress-bar", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  usePostHog: jest.fn(() => ({ capture: jest.fn() })),
}))

jest.mock("@/common/analytics/gtm", () => ({
  trackProgramEnrolled: jest.fn(),
}))

const makeMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product
const makeUserPricingDiscount = mitxFactories.products.userPricingDiscount
const makeFlexiblePrice = mitxFactories.products.discount
const makeProgramEnrollment = mitxFactories.enrollment.programEnrollmentV3
const makeUser = factories.user.user

function setupAuth() {
  setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
  setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
}

describe("ProgramEnrollArea — both scenario", () => {
  test("(a) Choose Your Path heading; paid button inside Certificate Track card; free button inside Learn for Free card; both medium", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct()],
    })

    renderWithProviders(<ProgramEnrollArea program={program} />)

    expect(await screen.findByText("Choose Your Path")).toBeInTheDocument()

    const earnBtn = await screen.findByRole("button", {
      name: "Earn Certificate",
    })
    const startBtn = await screen.findByRole("button", {
      name: "Start Learning",
    })

    const certHeading = screen.getByRole("heading", {
      name: "Certificate Track",
      level: 3,
    })
    const certCard = certHeading.closest("[data-card='cert']") as HTMLElement
    within(certCard).getByRole("button", { name: "Earn Certificate" })

    const freeHeading = screen.getByRole("heading", {
      name: "Learn for Free",
      level: 3,
    })
    const freeCard = freeHeading.closest("[data-card='free']") as HTMLElement
    within(freeCard).getByRole("button", { name: "Start Learning" })

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

describe("ProgramEnrollArea — paidOnly scenario", () => {
  test("(b) Certificate Track card; Enroll in Program button BELOW the card; large; no Choose Your Path", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct()],
    })

    renderWithProviders(<ProgramEnrollArea program={program} />)

    const enrollBtn = await screen.findByRole("button", {
      name: "Enroll in Program",
    })
    expect(enrollBtn).toBeInTheDocument()
    expect(screen.queryByText("Choose Your Path")).toBeNull()

    const certCell = document.querySelector("[data-card='cert']") as HTMLElement
    expect(certCell).not.toBeNull()
    within(certCell).getByRole("heading", {
      name: "Certificate Track",
      level: 3,
    })
    within(certCell).getByRole("button", { name: "Enroll in Program" })

    expect(enrollBtn.closest("[data-size]")).toHaveAttribute(
      "data-size",
      "large",
    )
  })

  test("(b) displayAsCourse forwards to the enroll button's label", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct()],
    })

    renderWithProviders(<ProgramEnrollArea program={program} displayAsCourse />)

    expect(
      await screen.findByRole("button", { name: "Enroll" }),
    ).toBeInTheDocument()
  })
})

describe("ProgramEnrollArea — freeOnly scenario", () => {
  test("(c) Learn for Free card; Start Learning button below; large", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
    })

    renderWithProviders(<ProgramEnrollArea program={program} />)

    const startBtn = await screen.findByRole("button", {
      name: "Start Learning",
    })
    expect(startBtn).toBeInTheDocument()

    const freeCell = document.querySelector("[data-card='free']") as HTMLElement
    expect(freeCell).not.toBeNull()
    within(freeCell).getByRole("heading", { name: "Learn for Free", level: 3 })
    within(freeCell).getByRole("button", { name: "Start Learning" })

    expect(startBtn.closest("[data-size]")).toHaveAttribute(
      "data-size",
      "large",
    )
  })
})

describe("ProgramEnrollArea — enrolled scenario", () => {
  test("(d) single Enrolled link to the program dashboard page; no cards; no Choose Your Path", async () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    const enrollment = makeProgramEnrollment({ program: { id: program.id } })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [
      enrollment,
    ])

    renderWithProviders(<ProgramEnrollArea program={program} />)

    const enrolledLink = await screen.findByRole("link", { name: /Enrolled/ })
    expect(enrolledLink).toBeInTheDocument()
    expect(enrolledLink).toHaveAttribute("href", programView(program.id))

    expect(screen.queryByText("Choose Your Path")).toBeNull()
    expect(
      screen.queryByRole("heading", { name: "Certificate Track" }),
    ).toBeNull()
    expect(screen.queryByRole("heading", { name: "Learn for Free" })).toBeNull()
  })
})

describe("ProgramEnrollArea — savings", () => {
  test("(e) savings block is visible inside the Certificate Track card when the list price is higher", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "800" })],
      page: { list_price: "1000" },
    })

    renderWithProviders(<ProgramEnrollArea program={program} />)

    await screen.findByRole("button", { name: "Enroll in Program" })
    const certCell = document.querySelector("[data-card='cert']") as HTMLElement
    within(certCell).getByText("Save $200")
  })

  test("(e) displayAsCourse suppresses the savings block even with a higher list price", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "800" })],
      page: { list_price: "1000" },
    })

    renderWithProviders(<ProgramEnrollArea program={program} displayAsCourse />)

    await screen.findByRole("button", { name: "Enroll" })
    expect(screen.queryByText("Save $200")).toBeNull()
    expect(screen.getByText("$800")).toBeInTheDocument()
  })
})

describe("ProgramEnrollArea — financial assistance link", () => {
  test("(f) shows the financial assistance link inside the Certificate Track card", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "800" })],
      page: {
        list_price: "800",
        financial_assistance_form_url: "/financial-aid/foo",
      },
    })

    renderWithProviders(<ProgramEnrollArea program={program} />)

    await screen.findByRole("button", { name: "Enroll in Program" })
    const certCell = document.querySelector("[data-card='cert']") as HTMLElement
    const link = within(certCell).getByRole("link", {
      name: "Apply for financial aid",
    })
    expect(link).toHaveAttribute(
      "href",
      mitxonlineLegacyUrl("/financial-aid/foo"),
    )
  })
})

describe("ProgramEnrollArea — applied savings", () => {
  test("(h) a quoted discount replaces the Certificate Track card under Choose Your Path", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct({ price: "899" })],
    })
    const discount = makeUserPricingDiscount({ amount_off: "300" })
    setupUserPricing(program, { user_price: "599", discount })

    renderWithProviders(<ProgramEnrollArea program={program} />)

    const upgrade = await screen.findByRole("button", {
      name: "Upgrade to Full Program",
    })
    const headingRow = screen.getByText("Choose Your Path")
      .parentElement as HTMLElement
    expect(headingRow).toHaveTextContent(
      "Your purchase is applied to the full program price.",
    )

    const certCell = document.querySelector("[data-card='cert']") as HTMLElement
    within(certCell).getByText(discount.source!.title)
    within(certCell).getByText("$599")
    within(certCell).getByRole("button", { name: "Upgrade to Full Program" })
    expect(
      screen.queryByRole("heading", { name: "Certificate Track" }),
    ).toBeNull()
    expect(upgrade.closest("[data-size]")).toHaveAttribute(
      "data-size",
      "medium",
    )

    // The free path is untouched, label included.
    screen.getByRole("heading", { name: "Learn for Free", level: 3 })
    screen.getByRole("button", { name: "Start Learning" })
  })

  test("(i) paid-only gains a heading, takes the button inside the box, and drops the savings block", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "800" })],
      page: { list_price: "1000" },
    })
    setupUserPricing(program, {
      user_price: "650",
      discount: makeUserPricingDiscount({ amount_off: "150" }),
    })

    renderWithProviders(<ProgramEnrollArea program={program} />)

    const upgrade = await screen.findByRole("button", {
      name: "Upgrade to Full Program",
    })
    const certCell = document.querySelector("[data-card='cert']") as HTMLElement
    within(certCell).getByText("Continue with full program")
    within(certCell).getByText("$650")
    expect(upgrade.closest("[data-size]")).toHaveAttribute(
      "data-size",
      "medium",
    )
    expect(screen.queryByText("Save $200")).toBeNull()
  })

  test("(i) paid-only aid carries no heading text and no note, keeping the row for its indicator", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "899" })],
      page: { financial_assistance_form_url: "/financial-aid/foo" },
    })
    setupUserPricing(program, {
      user_price: "399",
      discount: makeUserPricingDiscount({
        amount_off: "500",
        // The factory defaults to paid-amount-off, which reads as a credit.
        discount_type: DiscountTypeEnum.DollarsOff,
        payment_type: PaymentTypeEnum.FinancialAssistance,
      }),
      product_flexible_price: makeFlexiblePrice(),
    })

    renderWithProviders(<ProgramEnrollArea program={program} />)

    // Only a credit names the row, and only a credit explains itself beneath
    // it; aid leaves the heading, the note and the action alike in the
    // offering's own words.
    await screen.findByRole("button", { name: "Enroll in Program" })
    expect(screen.queryByText("Continue with full program")).toBeNull()
    const aid = screen.getByRole("link", { name: "Financial aid applied" })
    expect(aid.parentElement).toHaveTextContent("Financial aid applied")
    expect(aid.parentElement).not.toHaveTextContent(/is applied to/)
    screen.getByText("Program price")
  })

  test("(i) displayAsCourse keeps an aid breakdown, priced as a course", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "899" })],
      page: { financial_assistance_form_url: "/financial-aid/foo" },
    })
    setupUserPricing(program, {
      user_price: "399",
      discount: makeUserPricingDiscount({
        amount_off: "500",
        // The factory defaults to paid-amount-off, which reads as a credit.
        discount_type: DiscountTypeEnum.DollarsOff,
        payment_type: PaymentTypeEnum.FinancialAssistance,
      }),
      product_flexible_price: makeFlexiblePrice(),
    })

    renderWithProviders(<ProgramEnrollArea program={program} displayAsCourse />)

    await screen.findByRole("button", { name: "Enroll" })
    screen.getByText("Course price")
    expect(screen.queryByText("Program price")).toBeNull()
    screen.getByText("$399")
  })

  test("(i) displayAsCourse drops a credit, which has no course wording", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "800" })],
    })
    setupUserPricing(program, {
      user_price: "650",
      discount: makeUserPricingDiscount({
        amount_off: "150",
        discount_type: DiscountTypeEnum.PaidAmountOff,
      }),
    })

    renderWithProviders(<ProgramEnrollArea program={program} displayAsCourse />)

    await screen.findByRole("button", { name: "Enroll" })
    expect(screen.queryByText("Course price")).toBeNull()
    expect(screen.queryByText("Continue with full program")).toBeNull()
    screen.getByText("$800")
  })

  test.each([
    { approved: false, indicator: "Apply for financial aid" },
    { approved: true, indicator: "Financial aid applied" },
  ])(
    "(j) the aid indicator moves onto the heading row, reading $indicator",
    async ({ approved, indicator }) => {
      setupAuth()
      const program = makeProgram({
        enrollment_modes: [makeMode({ requires_payment: true })],
        products: [makeProduct({ price: "899" })],
        page: { financial_assistance_form_url: "/financial-aid/foo" },
      })
      setupUserPricing(program, {
        user_price: "599",
        discount: makeUserPricingDiscount({ amount_off: "300" }),
        product_flexible_price: approved ? makeFlexiblePrice() : null,
      })

      renderWithProviders(<ProgramEnrollArea program={program} />)

      await screen.findByRole("button", { name: "Upgrade to Full Program" })
      const headingRow = screen.getByText("Continue with full program")
        .parentElement as HTMLElement
      within(headingRow).getByRole("link", { name: indicator })
      expect(
        screen.queryByRole("heading", { name: "Certificate Track" }),
      ).toBeNull()
    },
  )
})

describe("ProgramEnrollArea — a quote that fails", () => {
  test("(k) the ordinary card stays, and the page survives", async () => {
    setupAuth()
    const product = makeProduct({ price: "800" })
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [product],
    })
    // A stale mitxonline session. The browser query client throws a 401 into
    // the route's error boundary unless the query opts out, which would replace
    // the whole program page — so rendering at all is half the assertion.
    setMockResponse.get(
      mitxUrls.products.userPricingDetail(product.id),
      {},
      { code: 401 },
    )

    renderWithProviders(<ProgramEnrollArea program={program} />)

    await waitFor(() =>
      expect(makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: mitxUrls.products.userPricingDetail(product.id),
        }),
      ),
    )
    await screen.findByRole("button", { name: "Enroll in Program" })
    screen.getByRole("heading", { name: "Certificate Track", level: 3 })
    screen.getByText("$800")
  })
})

describe("ProgramEnrollArea — none scenario", () => {
  test("(g) paid-only without a purchasable product renders nothing", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [],
    })

    renderWithProviders(<ProgramEnrollArea program={program} />)

    await waitFor(() => expect(screen.queryByRole("button")).toBeNull())
    expect(screen.queryByRole("heading")).toBeNull()
  })
})

describe("ProgramEnrollArea — loading state", () => {
  test("enrollment-status button is aria-busy and disabled while status is loading (spinner-first)", async () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
    })

    const { promise: mePromise, resolve: resolveMe } = (() => {
      let resolve!: (v: unknown) => void
      const promise = new Promise((r) => {
        resolve = r
      })
      return { promise, resolve }
    })()

    setMockResponse.get(urls.userMe.get(), mePromise)

    renderWithProviders(<ProgramEnrollArea program={program} />)

    const busyBtn = await screen.findByRole("button", { name: "Loading" })
    expect(busyBtn).toHaveAttribute("aria-busy", "true")
    expect(busyBtn).toBeDisabled()
    expect(
      screen.getByRole("heading", { name: "Learn for Free", level: 3 }),
    ).toBeInTheDocument()

    resolveMe(makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
    await screen.findByRole("button", { name: "Start Learning" })
  })
})
