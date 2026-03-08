import React from "react"
import { factories } from "api/mitxonline-test-utils"
import { renderWithProviders, screen } from "@/test-utils"
import ProgramInfoBox from "./ProgramInfoBox"

const makeProgram = factories.programs.program

jest.mock("./ProgramEnrollmentButton", () => {
  const MockProgramEnrollmentButton = () => (
    <button data-testid="mock-enroll-button">Enroll</button>
  )
  return { __esModule: true, default: MockProgramEnrollmentButton }
})

jest.mock("./ProductSummary", () => {
  const actual = jest.requireActual("./ProductSummary")
  return {
    ...actual,
    ProgramSummary: () => <div data-testid="mock-program-summary" />,
  }
})

describe("ProgramInfoBox", () => {
  test("renders summary card section with accessible 'Program summary' heading", () => {
    const program = makeProgram()
    renderWithProviders(<ProgramInfoBox program={program} />)
    const heading = screen.getByRole("heading", { name: "Program summary" })
    expect(heading).toBeInTheDocument()
    const section = screen.getByRole("region", { name: "Program summary" })
    expect(section).toBeInTheDocument()
  })

  test("renders program summary", () => {
    const program = makeProgram()
    renderWithProviders(<ProgramInfoBox program={program} />)
    expect(screen.getByTestId("mock-program-summary")).toBeInTheDocument()
  })

  test("renders enrollment button", () => {
    const program = makeProgram()
    renderWithProviders(<ProgramInfoBox program={program} />)
    expect(screen.getByTestId("mock-enroll-button")).toBeInTheDocument()
  })

  test("renders AskTIM button with text 'AskTIM about this program'", () => {
    const program = makeProgram()
    renderWithProviders(<ProgramInfoBox program={program} />)
    expect(
      screen.getByRole("button", { name: /AskTIM about this program/ }),
    ).toBeInTheDocument()
  })
})
