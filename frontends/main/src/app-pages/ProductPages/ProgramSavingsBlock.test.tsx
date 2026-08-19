import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import ProgramSavingsBlock from "./ProgramSavingsBlock"

describe("ProgramSavingsBlock", () => {
  test("renders current price, struck list price with original-price semantics, and the savings sentence", () => {
    renderWithProviders(
      <ProgramSavingsBlock
        current={{ min: 800, max: 800 }}
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

  test("an advertised range shows both ends, and the saving reads as a floor", () => {
    renderWithProviders(
      <ProgramSavingsBlock
        current={{ min: 500, max: 800 }}
        listAmount={1000}
        totalCourses={4}
      />,
    )

    expect(screen.getByText("$500 – $800")).toBeInTheDocument()
    // Only the saving against the top of the range is guaranteed.
    expect(screen.getByText("Save $200+")).toBeInTheDocument()
  })

  test("singular course count reads 'course', not 'courses'", () => {
    renderWithProviders(
      <ProgramSavingsBlock
        current={{ min: 90, max: 90 }}
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
