import React from "react"
import styled from "@emotion/styled"
import { theme } from "../ThemeProvider/ThemeProvider"
import { LearningResource, LearningResourcePrice } from "api"
import {
  formatRunDate,
  getDisplayPrice,
  getRunPrices,
  showStartAnytime,
} from "ol-utilities"

const DifferingRuns = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  alignSelf: "stretch",
  borderRadius: "4px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderBottom: "none",
})

const DifferingRun = styled.div({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "16px",
  padding: "12px",
  alignSelf: "stretch",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
})

const DifferingRunHeader = styled.div({
  display: "flex",
  alignSelf: "stretch",
  alignItems: "center",
  flex: "1 0 0",
  gap: "16px",
  padding: "12px",
  color: theme.custom.colors.darkGray2,
  backgroundColor: theme.custom.colors.lightGray1,
  ...theme.typography.subtitle3,
})

const DifferingRunData = styled.div({
  display: "flex",
  flexShrink: 0,
  flex: "1 0 0",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body3,
})

const DifferingRunLabel = styled.strong({
  display: "flex",
  flex: "1 0 0",
})

const DifferingRunLocation = styled(DifferingRunData)({
  flex: "1 0 100%",
  alignSelf: "stretch",
})

const DifferingRunsTable: React.FC<{ resource: LearningResource }> = ({
  resource,
}) => {
  if (!resource.runs) {
    return null
  }
  if (resource.runs.length === 1) {
    return null
  }
  const asTaughtIn = resource ? showStartAnytime(resource) : false
  const prices: LearningResourcePrice[] = []
  const deliveryMethods = []
  const locations = []
  for (const run of resource.runs) {
    if (run.resource_prices) {
      run.resource_prices.forEach((price) => {
        if (price.amount !== "0") {
          prices.push(price)
        }
      })
    }
    if (run.delivery) {
      deliveryMethods.push(run.delivery)
    }
    if (run.location) {
      locations.push(run.location)
    }
  }
  const distinctPrices = [...new Set(prices.map((p) => p.amount).flat())]
  console.log(distinctPrices)
  const distinctDeliveryMethods = [
    ...new Set(deliveryMethods.flat().map((dm) => dm?.code)),
  ]
  const distinctLocations = [...new Set(locations.flat().map((l) => l))]
  if (
    distinctPrices.length > 1 ||
    distinctDeliveryMethods.length > 1 ||
    distinctLocations.length > 1
  ) {
    return (
      <DifferingRuns data-testid="differing-runs-table">
        <DifferingRunHeader>
          <DifferingRunLabel>Date</DifferingRunLabel>
          <DifferingRunLabel>Price</DifferingRunLabel>
          <DifferingRunLabel>Format</DifferingRunLabel>
        </DifferingRunHeader>
        {resource.runs.map((run, index) => (
          <DifferingRun key={index}>
            <DifferingRunData>
              {formatRunDate(run, asTaughtIn)}
            </DifferingRunData>
            {run.resource_prices && (
              <DifferingRunData>
                <span>{getDisplayPrice(getRunPrices(run)["course"])}</span>
              </DifferingRunData>
            )}
            {run.delivery && (
              <DifferingRunData>
                <span>{run.delivery?.map((dm) => dm?.name).join(", ")}</span>
              </DifferingRunData>
            )}
            {run.delivery.filter((d) => d.code === "in_person").length > 0 &&
              run.location && (
                <DifferingRunLocation>
                  <strong>Location:&nbsp;</strong>
                  <span>{run.location}</span>
                </DifferingRunLocation>
              )}
          </DifferingRun>
        ))}
      </DifferingRuns>
    )
  }
  return null
}

export default DifferingRunsTable
