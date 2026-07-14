import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import ProgramSavingsBlock from "./ProgramSavingsBlock"

describe("ProgramSavingsBlock", () => {
  test("renders current price, struck list price with original-price semantics, and the savings sentence", () => {
    renderWithProviders(
      <ProgramSavingsBlock
        currentAmount={800}
        listAmount={1000}
        totalCourses={4}
      />,
    )

    expect(screen.getByText("$800")).toBeInTheDocument()
    expect(screen.getByText("full program")).toBeInTheDocument()
    expect(
      screen.getByRole("group", {
        name: "Original price: $1,000 purchased separately",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("Save $200")).toBeInTheDocument()
    expect(
      screen.getByText("compared to purchasing 4 courses separately", {
        exact: false,
      }),
    ).toBeInTheDocument()
  })

  test("singular course count reads 'course', not 'courses'", () => {
    renderWithProviders(
      <ProgramSavingsBlock
        currentAmount={90}
        listAmount={100}
        totalCourses={1}
      />,
    )

    expect(
      screen.getByText("compared to purchasing 1 course separately", {
        exact: false,
      }),
    ).toBeInTheDocument()
  })
})
