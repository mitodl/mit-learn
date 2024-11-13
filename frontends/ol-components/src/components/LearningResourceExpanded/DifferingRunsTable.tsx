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
  gap: "16px",
  padding: "12px",
  color: theme.custom.colors.darkGray2,
  backgroundColor: theme.custom.colors.lightGray1,
  ...theme.typography.subtitle3,
})

const DifferingRunData = styled.div({
  display: "flex",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body3,
})

const DifferingRunLabel = styled.strong({
  display: "flex",
})

const dateColumnStyle = {
  width: "130px",
  [theme.breakpoints.down("sm")]: {
    width: "auto",
    flex: "2 0 0",
  },
}

const priceColumnStyle = {
  width: "110px",
  [theme.breakpoints.down("sm")]: {
    width: "auto",
    flex: "1 0 0",
  },
}

const formatStyle = {
  flex: "1 0 0",
}

const DateLabel = styled(DifferingRunLabel)(dateColumnStyle)

const PriceLabel = styled(DifferingRunLabel)(priceColumnStyle)

const FormatLabel = styled(DifferingRunLabel)(formatStyle)

const DateData = styled(DifferingRunData)(dateColumnStyle)

const PriceData = styled(DifferingRunData)(priceColumnStyle)

const FormatData = styled(DifferingRunData)(formatStyle)

const DifferingRunLocation = styled(DifferingRunData)({
  flex: "1 0 100%",
  flexDirection: "column",
  alignSelf: "stretch",
})

const DifferingRunsTable: React.FC<{ resource: LearningResource }> = ({
  resource,
}) => {
  const asTaughtIn = resource ? showStartAnytime(resource) : false
  if (!allRunsAreIdentical(resource)) {
    return (
      <DifferingRuns data-testid="differing-runs-table">
        <DifferingRunHeader>
          <DateLabel>Date</DateLabel>
          <PriceLabel>Price</PriceLabel>
          <FormatLabel>Format</FormatLabel>
        </DifferingRunHeader>
        {resource.runs?.map((run, index) => (
          <DifferingRun key={index}>
            <DateData>{formatRunDate(run, asTaughtIn)}</DateData>
            {run.resource_prices && (
              <PriceData>
                <span>{getDisplayPrice(getRunPrices(run)["course"])}</span>
              </PriceData>
            )}
            {run.delivery && (
              <FormatData>
                <span>{run.delivery?.map((dm) => dm?.name).join(", ")}</span>
              </FormatData>
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
