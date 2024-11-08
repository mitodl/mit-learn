import React from "react"
import styled from "@emotion/styled"
import { theme } from "../ThemeProvider/ThemeProvider"
import { LearningResource } from "api"
import {
  allRunsAreIdentical,
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
  flexDirection: "column",
  alignSelf: "stretch",
})

const DifferingRunsTable: React.FC<{ resource: LearningResource }> = ({
  resource,
}) => {
  const asTaughtIn = resource ? showStartAnytime(resource) : false
  if (allRunsAreIdentical(resource)) {
    return (
      <DifferingRuns data-testid="differing-runs-table">
        <DifferingRunHeader>
          <DifferingRunLabel>Date</DifferingRunLabel>
          <DifferingRunLabel>Price</DifferingRunLabel>
          <DifferingRunLabel>Format</DifferingRunLabel>
        </DifferingRunHeader>
        {resource.runs?.map((run, index) => (
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
                  <strong>Location</strong>
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
