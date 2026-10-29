import React from "react"
import { renderWithProviders, screen, act, setMockResponse } from "@/test-utils"
import { factories, urls } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import { programView } from "@/common/urls"
import ProgramHeaderEnrollButton from "./ProgramHeaderEnrollButton"
import { makeProgram } from "./test-utils/userPricing"

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
const makeProgramEnrollment = mitxFactories.enrollment.programEnrollmentV3
const makeUser = factories.user.user

// The price suffix is mobile-only through a CSS media query, which jsdom does
// not apply, so it is part of the accessible name at every width here.
const pinnedPrice = { min_price: 899, max_price: 899 }

function setupAuth() {
  setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
  setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
  // Clicking enroll consults the MITx Online profile through the compliance
  // gate; the factory default has nothing missing, so it passes straight through.
  setMockResponse.get(mitxUrls.userMe.get(), mitxFactories.user.user())
}

describe("ProgramHeaderEnrollButton", () => {
  test("(a) both: header mirrors the paid recommended action", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [
        makeMode({ requires_payment: true }),
        makeMode({ requires_payment: false }),
      ],
      products: [makeProduct({ price: "899.00" })],
      ...pinnedPrice,
    })

    renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

    expect(
      await screen.findByRole("button", { name: "Earn Certificate - $899" }),
    ).toBeInTheDocument()
  })

  test("(b) paid-only program: header shows 'Enroll in Program' and the price", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "899.00" })],
      ...pinnedPrice,
    })

    renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

    expect(
      await screen.findByRole("button", { name: "Enroll in Program - $899" }),
    ).toBeInTheDocument()
  })

  test("(b2) advertised price range: header shows the range, as the InfoBox does", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "1000.00" })],
      min_price: 250,
      max_price: 1000,
    })

    renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

    expect(
      await screen.findByRole("button", {
        name: "Enroll in Program - $250 – $1,000",
      }),
    ).toBeInTheDocument()
  })

  test("(c) paid-only displayAsCourse: header shows 'Enroll' and the price", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "899.00" })],
      ...pinnedPrice,
    })

    renderWithProviders(
      <ProgramHeaderEnrollButton program={program} displayAsCourse />,
    )

    expect(
      await screen.findByRole("button", { name: "Enroll - $899" }),
    ).toBeInTheDocument()
  })

  test("(d) free-only: header shows 'Start Learning' without a price", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
      ...pinnedPrice,
    })

    renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

    expect(
      await screen.findByRole("button", { name: "Start Learning" }),
    ).toBeInTheDocument()
  })

  test("(e) enrolled: header shows an Enrolled link to the program dashboard page", async () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    const enrollment = makeProgramEnrollment({ program: { id: program.id } })

    setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
    setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [
      enrollment,
    ])

    renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

    const enrolledLink = await screen.findByRole("link", { name: /Enrolled/ })
    expect(enrolledLink).toHaveAttribute("href", programView(program.id))
  })

  test.each([
    {
      name: "no enrollment modes",
      enrollment_modes: [],
      products: [],
    },
    {
      name: "paid-only without a purchasable product",
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [],
    },
  ])(
    "(f) offering none ($name): header shows a disabled 'Enroll' placeholder",
    async ({ enrollment_modes: enrollmentModes, products }) => {
      setupAuth()
      const program = makeProgram({
        enrollment_modes: enrollmentModes,
        products,
      })

      renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

      expect(
        await screen.findByRole("button", { name: "Enroll" }),
      ).toBeDisabled()
    },
  )

  test("unauthenticated click shows the signup popover", async () => {
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    setMockResponse.get(
      urls.userMe.get(),
      makeUser({ is_authenticated: false }),
    )

    renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

    const startBtn = await screen.findByRole("button", {
      name: "Start Learning",
    })
    await act(async () => {
      startBtn.click()
    })

    expect(screen.getByTestId("signup-popover")).toBeInTheDocument()
  })

  test("shows an error alert below the button when enrollment fails", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    setMockResponse.post(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      undefined,
      { code: 500 },
    )

    renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

    const startBtn = await screen.findByRole("button", {
      name: "Start Learning",
    })
    await act(async () => {
      startBtn.click()
    })

    expect(
      await screen.findByText(
        "There was a problem processing your enrollment. Please try again.",
      ),
    ).toBeInTheDocument()
  })

  test("shows the server's 400 detail in place of the generic copy", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    setMockResponse.post(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      {
        detail:
          "Unable to complete enrollment. Please contact support. Error code: CS_700",
      },
      { code: 400 },
    )

    renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

    const startBtn = await screen.findByRole("button", {
      name: "Start Learning",
    })
    await act(async () => {
      startBtn.click()
    })

    expect(
      await screen.findByText(
        "Unable to complete enrollment. Please contact support. Error code: CS_700",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Contact Support" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        "There was a problem processing your enrollment. Please try again.",
      ),
    ).toBeNull()
  })

  test("falls back to the generic copy when a 400 carries no detail", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
    })
    setMockResponse.post(
      mitxUrls.programEnrollments.enrollmentsListV3(),
      { program_id: ["This field is required."] },
      { code: 400 },
    )

    renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

    const startBtn = await screen.findByRole("button", {
      name: "Start Learning",
    })
    await act(async () => {
      startBtn.click()
    })

    expect(
      await screen.findByText(
        "There was a problem processing your enrollment. Please try again.",
      ),
    ).toBeInTheDocument()
  })
})
