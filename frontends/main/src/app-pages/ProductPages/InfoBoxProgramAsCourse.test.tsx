import React from "react"
import fs from "fs"
import { renderWithProviders, screen, setMockResponse } from "@/test-utils"
import { factories as apiFactories, urls as apiUrls } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import InfoBoxProgramAsCourse from "./InfoBoxProgramAsCourse"

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
const makeBaseProgram = mitxFactories.programs.baseProgram
const makeMode = mitxFactories.courses.enrollmentMode
const makeProduct = mitxFactories.courses.product

function setupAuth() {
  setMockResponse.get(
    apiUrls.userMe.get(),
    apiFactories.user.user({ is_authenticated: true }),
  )
  setMockResponse.get(mitxUrls.programEnrollments.enrollmentsListV3(), [])
}

describe("InfoBoxProgramAsCourse — paid-only offering", () => {
  test("(a) Certificate Track card + Enroll (course label)", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "250" })],
    })

    renderWithProviders(<InfoBoxProgramAsCourse program={program} />)

    await screen.findByRole("button", { name: "Enroll" })
    expect(
      screen.getByRole("heading", { name: "Certificate Track", level: 3 }),
    ).toBeInTheDocument()
  })
})

describe("InfoBoxProgramAsCourse — both offering", () => {
  test("(b) Earn Certificate + Start Learning", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [
        makeMode({ requires_payment: false }),
        makeMode({ requires_payment: true }),
      ],
      products: [makeProduct()],
    })

    renderWithProviders(<InfoBoxProgramAsCourse program={program} />)

    await screen.findByRole("button", { name: "Earn Certificate" })
    expect(
      screen.getByRole("button", { name: "Start Learning" }),
    ).toBeInTheDocument()
  })
})

describe("InfoBoxProgramAsCourse — financial assistance", () => {
  test("(c) finaid link renders inside the Certificate Track card", async () => {
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
      mitxFactories.products.flexiblePrice({ product_flexible_price: null }),
    )

    renderWithProviders(<InfoBoxProgramAsCourse program={program} />)

    await screen.findByRole("button", { name: "Enroll" })
    expect(
      screen.getByRole("link", { name: "Financial assistance available" }),
    ).toBeInTheDocument()
  })
})

describe("InfoBoxProgramAsCourse — no savings", () => {
  test("(d) no savings block even when list_price is higher than product price", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: true })],
      products: [makeProduct({ price: "800" })],
      page: { list_price: "1000" },
    })

    renderWithProviders(<InfoBoxProgramAsCourse program={program} />)

    await screen.findByRole("button", { name: "Enroll" })
    expect(screen.getByText("$800")).toBeInTheDocument()
    expect(screen.queryByText(/Save/)).not.toBeInTheDocument()
  })
})

describe("InfoBoxProgramAsCourse — parent program upsell", () => {
  test("(e) shows 'Part of a Program' upsell when the program belongs to a parent program", async () => {
    setupAuth()
    const parentProgram = makeBaseProgram()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
      programs: [parentProgram],
    })
    setMockResponse.get(
      mitxUrls.programs.programsList({ id: [parentProgram.id] }),
      { results: [makeProgram({ id: parentProgram.id })] },
    )

    renderWithProviders(<InfoBoxProgramAsCourse program={program} />)

    await screen.findByTestId("program-bundle-upsell")
    expect(screen.getByText("Part of a Program")).toBeInTheDocument()
  })

  test("no upsell when the program has no parent programs", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
      programs: [],
    })

    renderWithProviders(<InfoBoxProgramAsCourse program={program} />)

    await screen.findByRole("button", { name: "Start Learning" })
    expect(
      screen.queryByTestId("program-bundle-upsell"),
    ).not.toBeInTheDocument()
  })
})

describe("InfoBoxProgramAsCourse — a11y heading", () => {
  test("labels the info box as 'Course Information'", async () => {
    setupAuth()
    const program = makeProgram({
      enrollment_modes: [makeMode({ requires_payment: false })],
    })

    renderWithProviders(<InfoBoxProgramAsCourse program={program} />)

    await screen.findByRole("button", { name: "Start Learning" })
    expect(
      screen.getByRole("heading", { name: "Course Information", level: 2 }),
    ).toBeInTheDocument()
  })
})

describe("InfoBoxProgramAsCourse — bespoke card removed", () => {
  test("(f) does not import the old bespoke ProgramAsCourseCertificateTrackCard", () => {
    const source = fs.readFileSync(`${__dirname}/InfoBoxProgramAsCourse.tsx`, {
      encoding: "utf-8",
    })
    expect(source).not.toMatch(/ProgramAsCourseCertificateTrackCard/)
  })
})
