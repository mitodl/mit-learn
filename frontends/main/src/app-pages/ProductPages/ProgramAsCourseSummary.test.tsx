import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import { factories } from "api/mitxonline-test-utils"
import {
  setMockResponse,
  urls as apiUrls,
  factories as apiFactories,
} from "api/test-utils"
import { formatDate } from "ol-utilities"
import invariant from "tiny-invariant"
import { ProgramAsCourseSummary, TestIds } from "./ProductSummary"

const makeProgram = factories.programs.program

describe("ProgramAsCourseSummary", () => {
  beforeEach(() => {
    setMockResponse.get(
      apiUrls.userMe.get(),
      apiFactories.user.user({ is_authenticated: false }),
    )
  })

  test("Renders duration row and does not render price row", () => {
    const program = makeProgram()
    renderWithProviders(<ProgramAsCourseSummary program={program} />)
    expect(screen.getByTestId(TestIds.DurationRow)).toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.PriceRow)).not.toBeInTheDocument()
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

  test("Does NOT render requirements or certificate row", () => {
    const program = makeProgram()
    renderWithProviders(<ProgramAsCourseSummary program={program} />)
    expect(
      screen.queryByTestId(TestIds.RequirementsRow),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId(TestIds.CertificateRow)).not.toBeInTheDocument()
  })

  test("Shows program-level start/end dates when both are set", () => {
    const program = makeProgram({
      start_date: "2026-09-01T00:00:00Z",
      end_date: "2026-12-15T00:00:00Z",
    })
    renderWithProviders(<ProgramAsCourseSummary program={program} />)
    const datesRow = screen.getByTestId(TestIds.DatesRow)
    invariant(program.start_date)
    expect(datesRow).toHaveTextContent(
      `Start: ${formatDate(program.start_date)}`,
    )
    invariant(program.end_date)
    expect(datesRow).toHaveTextContent(`End: ${formatDate(program.end_date)}`)
  })

  test("Omits the dates row when both start and end are unset, other rows still render", () => {
    const courserun = factories.courses.courseRun({ is_self_paced: true })
    const course = factories.courses.course({
      next_run_id: courserun.id,
      courseruns: [courserun],
    })
    const program = makeProgram({ start_date: null, end_date: null })
    renderWithProviders(
      <ProgramAsCourseSummary program={program} courses={[course]} />,
    )
    expect(screen.queryByTestId(TestIds.DatesRow)).not.toBeInTheDocument()
    expect(screen.getByTestId(TestIds.DurationRow)).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.PaceRow)).toBeInTheDocument()
  })

  test("Orders metadata rows as format, duration, dates", () => {
    const courserun = factories.courses.courseRun({ is_self_paced: true })
    const course = factories.courses.course({
      next_run_id: courserun.id,
      courseruns: [courserun],
    })
    const program = makeProgram()
    renderWithProviders(
      <ProgramAsCourseSummary program={program} courses={[course]} />,
    )
    const rows = screen.getAllByTestId(/-row$/)
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      TestIds.PaceRow,
      TestIds.DurationRow,
      TestIds.DatesRow,
    ])
  })
})
