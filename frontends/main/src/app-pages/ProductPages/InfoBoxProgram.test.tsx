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

describe("InfoBoxProgram — no offering", () => {
  test("data-boxes=1 and no section divider when there's nothing to enroll in", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [],
    })

    renderWithProviders(<InfoBoxProgram program={program} />)

    await screen.findByTestId(TestIds.CertificateRow)
    const grid = getBoxGrid()
    expect(grid).toHaveAttribute("data-boxes", "1")
    expect(grid.querySelector("hr")).toBeNull()
  })
})
