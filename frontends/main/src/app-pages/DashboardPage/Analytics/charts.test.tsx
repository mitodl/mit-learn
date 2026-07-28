import React from "react"
import { render, screen, within } from "@testing-library/react"
import { ThemeProvider } from "ol-components"
import { factories } from "api/analytics-test-utils"
import EngagementTrendChart from "./EngagementTrendChart"
import ProgramFunnelChart from "./ProgramFunnelChart"
import { CATEGORICAL, FUNNEL_STAGES } from "./chartPalette"

/**
 * Smoke coverage for the real charts (they are stubbed out in the page test).
 * jsdom does no layout, so there is no point asserting on geometry; what these
 * check is that the chart code runs, draws one mark per series, and paints
 * those marks with the validated palette rather than the library's defaults.
 */

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>)

describe("EngagementTrendChart", () => {
  const months = [
    factories.monthlyEngagementTrend({ activity_year_and_month: "2026-01" }),
    factories.monthlyEngagementTrend({ activity_year_and_month: "2026-02" }),
  ]

  test("renders a line per series in the categorical palette", () => {
    const { container } = renderWithTheme(
      <EngagementTrendChart rows={months} isLoading={false} />,
    )

    // Testing Library has no query for "which paint attribute did this SVG
    // element get", which is exactly what this asserts, so the container query
    // is the only way to check the palette actually reached the marks.
    // eslint-disable-next-line testing-library/no-container
    const lines = container.querySelectorAll(".MuiLineElement-root")
    expect(lines).toHaveLength(CATEGORICAL.length)
    const strokes = Array.from(lines).map((line) => line.getAttribute("stroke"))
    expect(strokes).toEqual([...CATEGORICAL])
  })

  // Scoped to the legend: the paired table repeats every series name as a
  // column header, which is the point of it, so an unscoped query matches twice.
  test("labels every series so identity is never carried by color alone", () => {
    renderWithTheme(<EngagementTrendChart rows={months} isLoading={false} />)

    expect(
      screen.getByText("Active learners", { selector: ".MuiChartsLabel-root" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("New enrollments", { selector: ".MuiChartsLabel-root" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Certificates earned", {
        selector: ".MuiChartsLabel-root",
      }),
    ).toBeInTheDocument()
  })

  test("shows an empty state rather than an empty chart", () => {
    renderWithTheme(<EngagementTrendChart rows={[]} isLoading={false} />)
    expect(
      screen.getByText("No monthly activity recorded yet."),
    ).toBeInTheDocument()
  })

  /**
   * A month suppressed by the anonymity floor must be a gap in the line, not a
   * dip to zero — so the null has to survive all the way into the series data.
   */
  test("renders a suppressed month without inventing a zero", () => {
    const rows = [
      factories.monthlyEngagementTrend({
        activity_year_and_month: "2026-01",
        new_enrollments: null,
        certificates_earned: null,
      }),
      factories.monthlyEngagementTrend({ activity_year_and_month: "2026-02" }),
    ]

    expect(() =>
      renderWithTheme(<EngagementTrendChart rows={rows} isLoading={false} />),
    ).not.toThrow()
  })

  /**
   * The SVG is unreadable to a screen reader, so the monthly numbers have to
   * exist as text too — the same pairing `ProgramFunnelChart` uses.
   */
  test("pairs the chart with a table of the same numbers", () => {
    renderWithTheme(
      <EngagementTrendChart
        rows={[
          factories.monthlyEngagementTrend({
            activity_year_and_month: "2026-01",
            monthly_active_learners: 84,
            new_enrollments: 21,
            certificates_earned: 7,
          }),
        ]}
        isLoading={false}
      />,
    )

    const table = screen.getByRole("table", { name: "Monthly engagement" })
    expect(within(table).getByText("Jan 2026")).toBeInTheDocument()
    expect(within(table).getByText("84")).toBeInTheDocument()
    expect(within(table).getByText("21")).toBeInTheDocument()
    expect(within(table).getByText("7")).toBeInTheDocument()
  })

  /**
   * A gap in a line reads as "no data" — only the table can say a month was
   * withheld and why.
   */
  test("explains suppressed months in the table instead of leaving a bare gap", () => {
    renderWithTheme(
      <EngagementTrendChart
        rows={[
          factories.monthlyEngagementTrend({
            activity_year_and_month: "2026-01",
            certificates_earned: null,
          }),
        ]}
        isLoading={false}
      />,
    )

    expect(
      screen.getAllByLabelText(/Withheld: too few learners/).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText(/Withheld: too few learners/)).toBeInTheDocument()
  })

  test("says the data could not be loaded rather than showing an empty state", () => {
    renderWithTheme(
      <EngagementTrendChart rows={undefined} isLoading={false} isError />,
    )

    expect(
      screen.getByText(
        "This data could not be loaded. Please try again later.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("No monthly activity recorded yet."),
    ).not.toBeInTheDocument()
  })
})

describe("ProgramFunnelChart", () => {
  const programs = [
    factories.programFunnel({
      program_title: "Widget Engineering",
      enrolled_in_contract_courses: 50,
      enrolled_via_program: 30,
      program_course_completers: 12,
    }),
  ]

  /**
   * Asserted via the legend swatches rather than the bars themselves: bar
   * geometry is derived from measured width, and jsdom reports zero, so no
   * `.MuiBarElement-root` is ever emitted here. The legend marks carry the same
   * per-series color, which is what this is actually checking.
   */
  test("assigns the ordinal ramp to the funnel stages in order", () => {
    const { container } = renderWithTheme(
      <ProgramFunnelChart rows={programs} isLoading={false} />,
    )

    // See the note on the line-chart palette test: paint attributes are not
    // reachable through a Testing Library query.
    // eslint-disable-next-line testing-library/no-container
    const swatches = container.querySelectorAll(".MuiChartsLabelMark-fill")
    expect(swatches).toHaveLength(FUNNEL_STAGES.length)
    expect(
      Array.from(swatches).map((swatch) => swatch.getAttribute("fill")),
    ).toEqual([...FUNNEL_STAGES])
  })

  test("labels every funnel stage so identity is never carried by color alone", () => {
    renderWithTheme(<ProgramFunnelChart rows={programs} isLoading={false} />)

    expect(
      screen.getByText("Enrolled in contract courses", {
        selector: ".MuiChartsLabel-root",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Enrolled via program", {
        selector: ".MuiChartsLabel-root",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Completed program courses", {
        selector: ".MuiChartsLabel-root",
      }),
    ).toBeInTheDocument()
  })

  test("pairs the chart with a table of the same numbers", () => {
    renderWithTheme(<ProgramFunnelChart rows={programs} isLoading={false} />)

    const table = screen.getByRole("table", { name: "Program funnel" })
    expect(table).toBeInTheDocument()
    expect(screen.getByText("50")).toBeInTheDocument()
    expect(screen.getByText("30")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
  })

  test("explains suppressed stages in the table instead of omitting them silently", () => {
    renderWithTheme(
      <ProgramFunnelChart
        rows={[
          factories.programFunnel({
            program_course_completers: null,
          }),
        ]}
        isLoading={false}
      />,
    )

    expect(
      screen.getAllByLabelText(/Withheld: too few learners/).length,
    ).toBeGreaterThan(0)
  })
})
