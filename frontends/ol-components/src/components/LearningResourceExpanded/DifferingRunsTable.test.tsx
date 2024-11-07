import React from "react"
import { render, screen, within } from "@testing-library/react"
import { courses } from "../LearningResourceCard/testUtils"
import InfoSectionV2 from "./InfoSectionV2"
import { ThemeProvider } from "../ThemeProvider/ThemeProvider"
import { DeliveryEnumDescriptions } from "api"

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
    const earthLocationLabels = within(differingRunsTable).getAllByText("Earth")
    expect(onlineLabels).toHaveLength(2)
    expect(inPersonLabels).toHaveLength(2)
    expect(onlinePriceLabels).toHaveLength(2)
    expect(inPersonPriceLabels).toHaveLength(2)
    expect(earthLocationLabels).toHaveLength(2)
  })
})
