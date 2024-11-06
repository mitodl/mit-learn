import React from "react"
import { render, screen, within } from "@testing-library/react"
import { courses } from "../LearningResourceCard/testUtils"
import InfoSectionV2 from "./InfoSectionV2"
import { ThemeProvider } from "../ThemeProvider/ThemeProvider"
import { formatRunDate } from "ol-utilities"
import invariant from "tiny-invariant"
import { DeliveryEnumDescriptions } from "api"

// This is a pipe followed by a zero-width space
const SEPARATOR = "|​"

describe("Learning resource info section pricing", () => {
  test("Free course, no certificate", () => {
    render(<InfoSectionV2 resource={courses.free.noCertificate} />, {
      wrapper: ThemeProvider,
    })

    screen.getByText("Free")
    expect(screen.queryByText("Paid")).toBeNull()
    expect(screen.queryByText("Earn a certificate:")).toBeNull()
    expect(screen.queryByText("Certificate included")).toBeNull()
  })

  test("Free course, with certificate, one price", () => {
    render(<InfoSectionV2 resource={courses.free.withCertificateOnePrice} />, {
      wrapper: ThemeProvider,
    })

    screen.getByText("Free")
    expect(screen.queryByText("Paid")).toBeNull()
    screen.getByText("Earn a certificate:")
    screen.getByText("$49")
  })

  test("Free course, with certificate, price range", () => {
    render(
      <InfoSectionV2 resource={courses.free.withCertificatePriceRange} />,
      {
        wrapper: ThemeProvider,
      },
    )

    screen.getByText("Free")
    expect(screen.queryByText("Paid")).toBeNull()
    screen.getByText("Earn a certificate:")
    screen.getByText("$49 – $99")
  })

  test("Unknown price, no certificate", () => {
    render(<InfoSectionV2 resource={courses.unknownPrice.noCertificate} />, {
      wrapper: ThemeProvider,
    })

    screen.getByText("Paid")
    expect(screen.queryByText("Free")).toBeNull()
    expect(screen.queryByText("Earn a certificate:")).toBeNull()
    expect(screen.queryByText("Certificate included")).toBeNull()
  })

  test("Unknown price, with certificate", () => {
    render(<InfoSectionV2 resource={courses.unknownPrice.withCertificate} />, {
      wrapper: ThemeProvider,
    })

    screen.getByText("Paid")
    expect(screen.queryByText("Free")).toBeNull()
    screen.getByText("Certificate included")
  })

  test("Paid course, no certificate", () => {
    render(<InfoSectionV2 resource={courses.paid.withoutCertificate} />, {
      wrapper: ThemeProvider,
    })

    screen.getByText("$49")
    expect(screen.queryByText("Paid")).toBeNull()
    expect(screen.queryByText("Free")).toBeNull()
    expect(screen.queryByText("Earn a certificate:")).toBeNull()
    expect(screen.queryByText("Certificate included")).toBeNull()
  })

  test("Paid course, with certificate, one price", () => {
    render(<InfoSectionV2 resource={courses.paid.withCerticateOnePrice} />, {
      wrapper: ThemeProvider,
    })

    screen.getByText("$49")
    expect(screen.queryByText("Paid")).toBeNull()
    screen.getByText("Certificate included")
  })

  test("Paid course, with certificate, price range", () => {
    render(
      <InfoSectionV2 resource={courses.paid.withCertificatePriceRange} />,
      {
        wrapper: ThemeProvider,
      },
    )

    screen.getByText("$49 – $99")
    expect(screen.queryByText("Paid")).toBeNull()
    screen.getByText("Certificate included")
  })
})

describe("Learning resource info section start date", () => {
  test("Start date", () => {
    const course = courses.free.dated
    const run = course.runs?.[0]
    invariant(run)
    const runDate = formatRunDate(run, false)
    invariant(runDate)
    render(<InfoSectionV2 resource={course} />, {
      wrapper: ThemeProvider,
    })

    const section = screen.getByTestId("drawer-info-items")
    within(section).getByText("Start Date:")
    within(section).getByText(runDate)
  })

  test("As taught in", () => {
    const course = courses.free.anytime
    const run = course.runs?.[0]
    invariant(run)
    const runDate = formatRunDate(run, true)
    invariant(runDate)
    render(<InfoSectionV2 resource={course} />, {
      wrapper: ThemeProvider,
    })

    const section = screen.getByTestId("drawer-info-items")
    within(section).getByText("As taught in:")
    within(section).getByText(runDate)
  })

  test("Multiple Runs", () => {
    const course = courses.free.multipleRuns
    const expectedDateText = course.runs
      ?.sort((a, b) => {
        if (a?.start_date && b?.start_date) {
          return Date.parse(a.start_date) - Date.parse(b.start_date)
        }
        return 0
      })
      .map((run) => formatRunDate(run, false))
      .join(SEPARATOR)
    invariant(expectedDateText)
    render(<InfoSectionV2 resource={course} />, {
      wrapper: ThemeProvider,
    })

    const section = screen.getByTestId("drawer-info-items")
    within(section).getByText((_content, node) => {
      return node?.textContent === expectedDateText || false
    })
  })
})
describe("Differing runs comparison table", () => {
  test("Does not appear if data is the same", () => {
    const course = courses.multipleRuns.sameData
    render(<InfoSectionV2 resource={course} />, {
      wrapper: ThemeProvider,
    })
    expect(screen.queryByTestId("differing-runs-table")).toBeNull()
  })

  test("Appears if data is different", () => {
    const course = courses.multipleRuns.differentData
    render(<InfoSectionV2 resource={course} />, {
      wrapper: ThemeProvider,
    })
    const differingRunsTable = screen.getByTestId("differing-runs-table")
    expect(differingRunsTable).toBeInTheDocument()
    const onlineLabels = within(differingRunsTable).getAllByText(
      DeliveryEnumDescriptions.online,
    )
    const inPersonLabels = within(differingRunsTable).getAllByText(
      DeliveryEnumDescriptions.in_person,
    )
    const onlinePriceLabels =
      within(differingRunsTable).getAllByText("$0, $100")
    const inPersonPriceLabels = within(differingRunsTable).getAllByText("$150")
    expect(onlineLabels).toHaveLength(2)
    expect(inPersonLabels).toHaveLength(2)
    expect(onlinePriceLabels).toHaveLength(2)
    expect(inPersonPriceLabels).toHaveLength(2)
  })
})
