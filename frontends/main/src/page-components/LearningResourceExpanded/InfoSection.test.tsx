import React from "react"
import { screen, within } from "@testing-library/react"
import { courses } from "./testUtils"
import InfoSection from "./InfoSection"
import { formatRunDate } from "ol-utilities"
import invariant from "tiny-invariant"
import user from "@testing-library/user-event"
import { renderWithTheme } from "../../test-utils"

// This is a pipe followed by a zero-width space
const SEPARATOR = "|​"

describe("Learning resource info section pricing", () => {
  test("Free course, no certificate", () => {
    renderWithTheme(<InfoSection resource={courses.free.noCertificate} />)

    screen.getByText("Free")
    expect(screen.queryByText("Paid")).toBeNull()
    expect(screen.queryByText("Earn a certificate:")).toBeNull()
    expect(screen.queryByText("Certificate included")).toBeNull()
  })

  test("Free course, with certificate, one price", () => {
    renderWithTheme(
      <InfoSection resource={courses.free.withCertificateOnePrice} />,
    )

    screen.getByText("Free")
    expect(screen.queryByText("Paid")).toBeNull()
    screen.getByText("Earn a certificate:")
    screen.getByText("$49")
  })

  test("Free course, with certificate, price range", () => {
    renderWithTheme(
      <InfoSection resource={courses.free.withCertificatePriceRange} />,
    )

    screen.getByText("Free")
    expect(screen.queryByText("Paid")).toBeNull()
    screen.getByText("Earn a certificate:")
    screen.getByText("$49 – $99")
  })

  test("Unknown price, no certificate", () => {
    renderWithTheme(
      <InfoSection resource={courses.unknownPrice.noCertificate} />,
    )

    screen.getByText("Paid")
    expect(screen.queryByText("Free")).toBeNull()
    expect(screen.queryByText("Earn a certificate:")).toBeNull()
    expect(screen.queryByText("Certificate included")).toBeNull()
  })

  test("Unknown price, with certificate", () => {
    renderWithTheme(
      <InfoSection resource={courses.unknownPrice.withCertificate} />,
    )

    screen.getByText("Paid")
    expect(screen.queryByText("Free")).toBeNull()
    screen.getByText("Certificate:")
    screen.getByText(
      courses.unknownPrice.withCertificate.certification_type.name,
    )
  })

  test("Paid course, no certificate", () => {
    renderWithTheme(<InfoSection resource={courses.paid.withoutCertificate} />)

    screen.getByText("$49")
    expect(screen.queryByText("Paid")).toBeNull()
    expect(screen.queryByText("Free")).toBeNull()
    expect(screen.queryByText("Earn a certificate:")).toBeNull()
    expect(screen.queryByText("Certificate included")).toBeNull()
  })

  test("Paid course, with certificate, one price", () => {
    renderWithTheme(
      <InfoSection resource={courses.paid.withCerticateOnePrice} />,
    )

    screen.getByText("$49")
    expect(screen.queryByText("Paid")).toBeNull()
    screen.getByText("Certificate:")
    screen.getByText(courses.paid.withCerticateOnePrice.certification_type.name)
  })

  test("Paid course, with certificate, price range", () => {
    renderWithTheme(
      <InfoSection resource={courses.paid.withCertificatePriceRange} />,
    )

    screen.getByText("$49 – $99")
    expect(screen.queryByText("Paid")).toBeNull()
    screen.getByText("Certificate:")
    screen.getByText(
      courses.paid.withCertificatePriceRange.certification_type.name,
    )
  })
})

describe("Learning resource info section start date", () => {
  test("Start date(s)", () => {
    const course = courses.free.dated
    const run = course.runs?.[0]
    invariant(run)
    const runDate = formatRunDate(run, false)
    invariant(runDate)
    renderWithTheme(<InfoSection resource={course} />)

    const section = screen.getByTestId("drawer-info-items")
    within(section).getByText("Starts:")
    within(section).getByText(runDate)
  })

  test("Uses next_start_date when available", () => {
    const course = {
      ...courses.free.dated,
      next_start_date: "2024-03-15T00:00:00Z",
    }
    renderWithTheme(<InfoSection resource={course} />)

    const section = screen.getByTestId("drawer-info-items")
    within(section).getByText("Starts:")
    within(section).getByText("March 15, 2024")
  })

  test("Falls back to run date when next_start_date is null", () => {
    const course = {
      ...courses.free.dated,
      next_start_date: null,
    }
    const run = course.runs?.[0]
    invariant(run)
    const runDate = formatRunDate(run, false)
    invariant(runDate)
    renderWithTheme(<InfoSection resource={course} />)

    const section = screen.getByTestId("drawer-info-items")
    within(section).getByText("Starts:")
    within(section).getByText(runDate)
    expect(within(section).queryByText("March 15, 2024")).toBeNull()
  })

  test("As taught in date(s)", () => {
    const course = courses.free.anytime
    const run = course.runs?.[0]
    invariant(run)
    const runDate = formatRunDate(run, true)
    invariant(runDate)
    renderWithTheme(<InfoSection resource={course} />)

    const section = screen.getByTestId("drawer-info-items")
    const expectedDateText = `As taught in:${runDate}`
    within(section).getAllByText((_content, node) => {
      return node?.textContent === expectedDateText || false
    })
  })

  test("Multiple run dates", () => {
    const course = courses.multipleRuns.sameData
    const expectedDateText = `${course.runs
      ?.sort((a, b) => {
        if (a?.start_date && b?.start_date) {
          return Date.parse(a.start_date) - Date.parse(b.start_date)
        }
        return 0
      })
      .map((run) => formatRunDate(run, false))
      .slice(0, 2)
      .join(SEPARATOR)}Show more`
    invariant(expectedDateText)
    renderWithTheme(<InfoSection resource={course} />)

    const section = screen.getByTestId("drawer-info-items")
    within(section).getAllByText((_content, node) => {
      return node?.textContent === expectedDateText || false
    })
  })

  test("Multiple run dates with next_start_date uses next_start_date as first date", () => {
    const course = {
      ...courses.multipleRuns.sameData,
      next_start_date: "2024-01-15T00:00:00Z",
    }
    const sortedDates = course.runs
      ?.sort((a, b) => {
        if (a?.start_date && b?.start_date) {
          return Date.parse(a.start_date) - Date.parse(b.start_date)
        }
        return 0
      })
      .map((run) => formatRunDate(run, false))
      .filter((date) => date !== null)

    // First date should be next_start_date, second should be original second date
    const expectedDateText = `January 15, 2024${SEPARATOR}${sortedDates?.[1]}Show more`
    renderWithTheme(<InfoSection resource={course} />)

    const section = screen.getByTestId("drawer-info-items")
    within(section).getAllByText((_content, node) => {
      return node?.textContent === expectedDateText || false
    })
  })

  test("If data is different then dates, formats, locations and prices are not shown", () => {
    const course = courses.multipleRuns.differentData
    renderWithTheme(<InfoSection resource={course} />)
    const section = screen.getByTestId("drawer-info-items")
    expect(within(section).queryByText("Starts:")).toBeNull()
    expect(within(section).queryByText("Price:")).toBeNull()
    expect(within(section).queryByText("Format:")).toBeNull()
    expect(within(section).queryByText("Location:")).toBeNull()
  })

  test("Clicking the show more button should show more dates", async () => {
    const course = courses.multipleRuns.sameData
    const totalRuns = course.runs?.length ? course.runs.length : 0
    renderWithTheme(<InfoSection resource={course} />)

    const runDates = screen.getByTestId("drawer-run-dates")
    expect(runDates.children.length).toBe(3)
    const showMoreLink = within(runDates).getByText("Show more")
    await user.click(showMoreLink)
    expect(runDates.children.length).toBe(totalRuns + 1)
  })
})

describe("Learning resource info section format and location", () => {
  test("Multiple formats", () => {
    const course = courses.multipleFormats
    renderWithTheme(<InfoSection resource={course} />)

    const section = screen.getByTestId("drawer-info-items")
    within(section).getAllByText((_content, node) => {
      // The pipe in this string is followed by a zero width space
      return node?.textContent === "Format:Online|​In person" || false
    })
    within(section).getAllByText((_content, node) => {
      return node?.textContent === "Location:Earth" || false
    })
  })

  test("Single format", () => {
    const course = courses.singleFormat
    renderWithTheme(<InfoSection resource={course} />)

    const section = screen.getByTestId("drawer-info-items")
    within(section).getAllByText((_content, node) => {
      return node?.textContent === "Format:Online" || false
    })
    expect(within(section).queryByText("In person")).toBeNull()
  })
})
