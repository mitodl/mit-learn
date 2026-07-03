import React from "react"
import { renderWithProviders, screen, act, setMockResponse } from "@/test-utils"
import { factories, urls } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import { programView } from "@/common/urls"
import ProgramHeaderEnrollButton from "./ProgramHeaderEnrollButton"

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

const makeProgram = mitxFactories.programs.program
const makeMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product
const makeProgramEnrollment = mitxFactories.enrollment.programEnrollmentV3
const makeUser = factories.user.user

function setupAuth() {
  setMockResponse.get(urls.userMe.get(), makeUser({ is_authenticated: true }))
  setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
}

describe("ProgramHeaderEnrollButton", () => {
  test("(a) both: header mirrors the paid recommended action", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [
        makeMode({ requires_payment: true }),
        makeMode({ requires_payment: false }),
      ],
      products: [makeProduct()],
    })

    renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

    expect(
      await screen.findByRole("button", { name: "Earn Certificate" }),
    ).toBeInTheDocument()
  })

  test("(b) paid-only program: header shows 'Enroll in Program'", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct()],
    })

    renderWithProviders(<ProgramHeaderEnrollButton program={program} />)

    expect(
      await screen.findByRole("button", { name: "Enroll in Program" }),
    ).toBeInTheDocument()
  })

  test("(c) paid-only displayAsCourse: header shows 'Enroll'", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct()],
    })

    renderWithProviders(
      <ProgramHeaderEnrollButton program={program} displayAsCourse />,
    )

    expect(
      await screen.findByRole("button", { name: "Enroll" }),
    ).toBeInTheDocument()
  })

  test("(d) free-only: header shows 'Start Learning'", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
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
})
