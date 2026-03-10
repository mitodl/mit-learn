import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import ProgramAsCourseSummary from "./ProgramAsCourseSummary"
import { factories } from "api/mitxonline-test-utils"
import { TestIds } from "./ProductSummary"

const makeProgram = factories.programs.program

describe("ProgramAsCourseSummary", () => {
  test("Renders duration, pace, and price rows", () => {
    const program = makeProgram({
      page: {
        length: "6 weeks",
        effort: "5 hours/week",
        feature_image_src: "",
        page_url: "",
        financial_assistance_form_url: "",
        description: "",
        live: true,
        price: "100",
      },
    })
    renderWithProviders(<ProgramAsCourseSummary program={program} />)
    expect(screen.getByTestId(TestIds.DurationRow)).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.PriceRow)).toBeInTheDocument()
  })

  test("Does NOT render requirements row", () => {
    const program = makeProgram()
    renderWithProviders(<ProgramAsCourseSummary program={program} />)
    expect(
      screen.queryByTestId(TestIds.RequirementsRow),
    ).not.toBeInTheDocument()
  })
})
