import React from "react"
import { render, screen } from "@testing-library/react"
import { ThemeProvider } from "ol-components"
import {
  formatCount,
  formatDate,
  formatPercent,
  formatYearMonth,
  formatYearMonthShort,
  SUPPRESSED_EXPLANATION,
  SuppressibleValue,
} from "./format"

describe("formatYearMonth", () => {
  test.each([
    { input: "2026-01", long: "Jan 2026", short: "Jan" },
    { input: "2026-12", long: "Dec 2026", short: "Dec" },
  ])("formats $input as $long", ({ input, long, short }) => {
    expect(formatYearMonth(input)).toBe(long)
    expect(formatYearMonthShort(input)).toBe(short)
  })

  /**
   * `new Date("2026-03")` is parsed as UTC midnight, which renders as February
   * for anyone west of Greenwich. The formatter builds a local date instead;
   * this is the regression guard for that.
   */
  test("does not shift the month across timezones", () => {
    expect(formatYearMonth("2026-03")).toBe("Mar 2026")
  })

  test("passes an unparseable value through rather than rendering garbage", () => {
    expect(formatYearMonth("not-a-month")).toBe("not-a-month")
    expect(formatYearMonthShort("")).toBe("")
  })
})

describe("number formatting", () => {
  test("counts are thousands-separated", () => {
    expect(formatCount(1234567)).toBe("1,234,567")
  })

  test("percentages keep at most one decimal", () => {
    expect(formatPercent(62)).toBe("62%")
    expect(formatPercent(32.35)).toBe("32.4%")
  })

  test("formatDate returns null for missing or invalid dates", () => {
    expect(formatDate(null)).toBeNull()
    expect(formatDate(undefined)).toBeNull()
    expect(formatDate("nope")).toBeNull()
    expect(formatDate("2026-01-15")).toBe("Jan 15, 2026")
  })
})

describe("SuppressibleValue", () => {
  const renderValue = (value: number | null) =>
    render(
      <ThemeProvider>
        <SuppressibleValue value={value} />
      </ThemeProvider>,
    )

  test("renders the formatted number when the API returned one", () => {
    renderValue(42)
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  /**
   * The whole point of the component: a suppressed value must never read as
   * zero, and its reason must be available without hovering.
   */
  test("explains a suppressed value instead of showing zero", () => {
    renderValue(null)
    expect(screen.queryByText("0")).not.toBeInTheDocument()
    expect(screen.getByLabelText(SUPPRESSED_EXPLANATION)).toBeInTheDocument()
  })

  test("zero is a real value and is rendered as such", () => {
    renderValue(0)
    expect(screen.getByText("0")).toBeInTheDocument()
    expect(
      screen.queryByLabelText(SUPPRESSED_EXPLANATION),
    ).not.toBeInTheDocument()
  })
})
