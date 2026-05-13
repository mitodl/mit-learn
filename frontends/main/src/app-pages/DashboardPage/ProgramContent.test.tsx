import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import ProgramContent from "./ProgramContent"

jest.mock("./CoursewareDisplay/ProgramEnrollmentDisplay", () => ({
  ProgramEnrollmentDisplay: jest.fn(({ programId }) => (
    <div data-testid="program-enrollment-display" data-program-id={programId}>
      Mocked ProgramEnrollmentDisplay with programId: {programId}
    </div>
  )),
}))

describe("ProgramContent", () => {
  test("renders ProgramEnrollmentDisplay with programId prop", () => {
    const programId = 123
    renderWithProviders(<ProgramContent programId={programId} />)

    const programEnrollmentDisplay = screen.getByTestId(
      "program-enrollment-display",
    )
    expect(programEnrollmentDisplay).toBeInTheDocument()
    expect(programEnrollmentDisplay).toHaveAttribute("data-program-id", "123")
  })

  test("passes correct programId to ProgramEnrollmentDisplay", () => {
    const programId = 456
    renderWithProviders(<ProgramContent programId={programId} />)

    expect(
      screen.getByText(
        `Mocked ProgramEnrollmentDisplay with programId: ${programId}`,
      ),
    ).toBeInTheDocument()
  })

  test("handles different programId values", () => {
    const { view } = renderWithProviders(<ProgramContent programId={1} />)
    expect(screen.getByTestId("program-enrollment-display")).toHaveAttribute(
      "data-program-id",
      "1",
    )

    view.rerender(<ProgramContent programId={999} />)
    expect(screen.getByTestId("program-enrollment-display")).toHaveAttribute(
      "data-program-id",
      "999",
    )
  })
})
