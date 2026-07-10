import React from "react"
import {
  renderWithProviders,
  screen,
  within,
  setMockResponse,
} from "@/test-utils"
import { factories as apiFactories, urls as apiUrls } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import InfoBoxProgram from "./InfoBoxProgram"
import { TestIds } from "./ProductSummary"

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
const makeProgramEnrollment = mitxFactories.enrollment.programEnrollmentV3

function setupAuth(enrollments: unknown[] = []) {
  setMockResponse.get(
    apiUrls.userMe.get(),
    apiFactories.user.user({ is_authenticated: true }),
  )
  setMockResponse.get(
    mitxUrls.programEnrollments.enrollmentsListV3(),
    enrollments,
  )
}

const getBoxGrid = () => document.querySelector("[data-boxes]") as HTMLElement

describe("InfoBoxProgram — both offering", () => {
  test("(a) meta rows + both cards + Choose Your Path within one info box", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct()],
      certificate_available: true,
    })

    renderWithProviders(<InfoBoxProgram program={program} />)

    await screen.findByText("Choose Your Path")
    const grid = getBoxGrid()
    expect(grid).toHaveAttribute("data-boxes", "3")
    within(grid).getByTestId(TestIds.CertificateRow)
    within(grid).getByRole("heading", { name: "Certificate Track", level: 3 })
    within(grid).getByRole("heading", { name: "Learn for Free", level: 3 })
  })
})

describe("InfoBoxProgram — paid-only offering", () => {
  test("(b) meta + Certificate Track card + Enroll in Program", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct()],
      certificate_available: true,
    })

    renderWithProviders(<InfoBoxProgram program={program} />)

    await screen.findByRole("button", { name: "Enroll in Program" })
    const grid = getBoxGrid()
    expect(grid).toHaveAttribute("data-boxes", "2")
    expect(grid.querySelector("hr")).not.toBeNull()
    within(grid).getByTestId(TestIds.CertificateRow)
    within(grid).getByRole("heading", { name: "Certificate Track", level: 3 })
    expect(within(grid).queryByText("Choose Your Path")).toBeNull()
  })
})

describe("InfoBoxProgram — savings", () => {
  test("(c) savings block is present in the Certificate Track card", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "800" })],
      page: { list_price: "1000" },
    })

    renderWithProviders(<InfoBoxProgram program={program} />)

    await screen.findByRole("button", { name: "Enroll in Program" })
    expect(screen.getByText("Save $200")).toBeInTheDocument()
  })
})

describe("InfoBoxProgram — enrolled offering", () => {
  test("data-boxes=2 for enrolled scenario (enrolled link = 1 offering box)", async () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    setupAuth([makeProgramEnrollment({ program: { id: program.id } })])

    renderWithProviders(<InfoBoxProgram program={program} />)

    await screen.findByRole("link", { name: /Enrolled/ })

    const grid = getBoxGrid()
    expect(grid).toHaveAttribute("data-boxes", "2")
  })
})

describe("InfoBoxProgram — grid structure", () => {
  test("paidOnly: grid has exactly meta + divider + one offering wrapper; Enroll button shares the wrapper with the Certificate Track card", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct()],
    })

    renderWithProviders(<InfoBoxProgram program={program} />)

    await screen.findByRole("button", { name: "Enroll in Program" })

    const grid = getBoxGrid()
    expect(grid).not.toBeNull()

    // Exactly 3 direct element children: [data-grid-meta], the section divider
    // (hr), and the single offering wrapper [data-card="cert"]. The card and its
    // Enroll button must live in ONE wrapper, not as separate grid children.
    expect(Array.from(grid.children)).toHaveLength(3)
    expect(grid.querySelector("[data-grid-meta]")).not.toBeNull()
    expect(grid.querySelector("hr")).not.toBeNull()

    const offeringWrapper = grid.querySelector(
      "[data-card='cert']",
    ) as HTMLElement
    expect(offeringWrapper).not.toBeNull()
    expect(
      within(offeringWrapper).getByRole("heading", {
        name: "Certificate Track",
        level: 3,
      }),
    ).toBeInTheDocument()
    expect(
      within(offeringWrapper).getByRole("button", {
        name: "Enroll in Program",
      }),
    ).toBeInTheDocument()
  })
})

describe("InfoBoxProgram — no offering", () => {
  test("data-boxes=1 and no section divider when there's nothing to enroll in", async () => {
    setupAuth()
    // Paid mode but no purchasable product: nothing enrollable, so one box and
    // no divider. certificate_available tracks the paid mode independently of
    // products, so the certificate row still renders — we don't police this
    // bad-data combination.
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [],
      certificate_available: true,
    })

    renderWithProviders(<InfoBoxProgram program={program} />)

    await screen.findByTestId(TestIds.CertificateRow)
    const grid = getBoxGrid()
    expect(grid).toHaveAttribute("data-boxes", "1")
    expect(grid.querySelector("hr")).toBeNull()
  })
})
