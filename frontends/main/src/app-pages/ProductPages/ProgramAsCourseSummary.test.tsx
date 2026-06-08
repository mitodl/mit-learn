import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { factories } from "api/mitxonline-test-utils"
import {
  setMockResponse,
  urls as apiUrls,
  factories as apiFactories,
} from "api/test-utils"
import { ProgramAsCourseSummary, TestIds } from "./ProductSummary"

const makeProgram = factories.programs.program

describe("ProgramAsCourseSummary", () => {
  beforeEach(() => {
    setMockResponse.get(
      apiUrls.userMe.get(),
      apiFactories.user.user({ is_authenticated: false }),
    )
  })

  test("Renders duration and price rows", () => {
    const program = makeProgram()
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
