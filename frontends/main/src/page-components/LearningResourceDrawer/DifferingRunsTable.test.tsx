import React from "react"
import { screen, within } from "@testing-library/react"
import { courses } from "./testUtils"
import InfoSection from "./InfoSection"
import { DeliveryEnumDescriptions } from "api"
import { renderWithTheme } from "@/test-utils"

describe("Differing runs comparison table", () => {
  test("Does not appear if data is the same", () => {
    const course = courses.multipleRuns.sameData
    renderWithTheme(<InfoSection resource={course} />)
    expect(screen.queryByTestId("differing-runs-table")).toBeNull()
  })

  test("Appears if data is different", () => {
    const course = courses.multipleRuns.differentData
    renderWithTheme(<InfoSection resource={course} />)
    const differingRunsTable = screen.getByTestId("differing-runs-table")
    expect(differingRunsTable).toBeInTheDocument()
    const onlineLabels = within(differingRunsTable).getAllByText(
      DeliveryEnumDescriptions.online,
    )
    const inPersonLabels = within(differingRunsTable).getAllByText(
      DeliveryEnumDescriptions.in_person,
    )
    const onlinePriceLabels = within(differingRunsTable).getAllByText("$100")
    const inPersonPriceLabels = within(differingRunsTable).getAllByText("$150")
    const earthLocationLabels = within(differingRunsTable).getAllByText("Earth")
    expect(onlineLabels).toHaveLength(2)
    expect(inPersonLabels).toHaveLength(2)
    expect(onlinePriceLabels).toHaveLength(2)
    expect(inPersonPriceLabels).toHaveLength(2)
    expect(earthLocationLabels).toHaveLength(2)
  })
})
