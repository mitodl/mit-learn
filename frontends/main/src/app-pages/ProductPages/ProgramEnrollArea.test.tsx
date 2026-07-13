import React from "react"
import {
  renderWithProviders,
  screen,
  within,
  waitFor,
  setMockResponse,
} from "@/test-utils"
import { factories, urls } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import { mitxonlineLegacyUrl } from "@/common/mitxonline"
import { programView } from "@/common/urls"
import ProgramEnrollArea from "./ProgramEnrollArea"

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

const makeProgram = mitxFactories.programs.program
const makeMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product
const makeFlexiblePrice = mitxFactories.products.flexiblePrice
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
    const product = makeProduct({ price: "800" })
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [product],
      page: {
        list_price: "800",
        financial_assistance_form_url: "/financial-aid/foo",
      },
    })
    setMockResponse.get(
      mitxUrls.products.userFlexiblePriceDetail(product.id),
      makeFlexiblePrice({ product_flexible_price: null }),
    )

    renderWithProviders(<ProgramEnrollArea program={program} />)

    await screen.findByRole("button", { name: "Enroll in Program" })
    const certCell = document.querySelector("[data-card='cert']") as HTMLElement
    const link = within(certCell).getByRole("link", {
      name: "Financial assistance available",
    })
    expect(link).toHaveAttribute(
      "href",
      mitxonlineLegacyUrl("/financial-aid/foo"),
    )
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
