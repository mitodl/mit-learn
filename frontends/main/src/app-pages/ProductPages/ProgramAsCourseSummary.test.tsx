import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import ProgramAsCourseSummary from "./ProgramAsCourseSummary"
import { factories } from "api/mitxonline-test-utils"
import { TestIds } from "./ProductSummary"

const makeProgram = factories.programs.program

describe("ProgramAsCourseSummary", () => {
  test("Renders duration and price rows", () => {
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

  test("Renders pace row when courses are provided", () => {
    const courserun = factories.courses.courseRun({
      is_self_paced: true,
    })
    const course = factories.courses.course({
      next_run_id: courserun.id,
      courseruns: [courserun],
    })
    const program = makeProgram()
    renderWithProviders(
      <ProgramAsCourseSummary program={program} courses={[course]} />,
    )
    expect(screen.getByTestId(TestIds.PaceRow)).toBeInTheDocument()
  })

  test("Does NOT render requirements row", () => {
    const program = makeProgram()
    renderWithProviders(<ProgramAsCourseSummary program={program} />)
    expect(
      screen.queryByTestId(TestIds.RequirementsRow),
    ).not.toBeInTheDocument()
  })
})
