import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import ProgramContent from "./ProgramContent"

// Mock the EnrollmentDisplay component
jest.mock("./CoursewareDisplay/EnrollmentDisplay", () => ({
  EnrollmentDisplay: jest.fn(({ programId }) => (
    <div data-testid="enrollment-display" data-program-id={programId}>
      Mocked EnrollmentDisplay with programId: {programId}
    </div>
  )),
}))

describe("ProgramContent", () => {
  test("renders EnrollmentDisplay with programId prop", () => {
    const programId = 123
    renderWithProviders(<ProgramContent programId={programId} />)

    const enrollmentDisplay = screen.getByTestId("enrollment-display")
    expect(enrollmentDisplay).toBeInTheDocument()
    expect(enrollmentDisplay).toHaveAttribute("data-program-id", "123")
  })

  test("passes correct programId to EnrollmentDisplay", () => {
    const programId = 456
    renderWithProviders(<ProgramContent programId={programId} />)

    expect(
      screen.getByText(`Mocked EnrollmentDisplay with programId: ${programId}`),
    ).toBeInTheDocument()
  })

  test("handles different programId values", () => {
    const { view } = renderWithProviders(<ProgramContent programId={1} />)
    expect(screen.getByTestId("enrollment-display")).toHaveAttribute(
      "data-program-id",
      "1",
    )

    view.rerender(<ProgramContent programId={999} />)
    expect(screen.getByTestId("enrollment-display")).toHaveAttribute(
      "data-program-id",
      "999",
    )
  })
})
