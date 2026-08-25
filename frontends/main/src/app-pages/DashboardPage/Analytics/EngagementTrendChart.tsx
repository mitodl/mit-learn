"use client"

import React from "react"
import { LineChart } from "@mui/x-charts/LineChart"
import { Skeleton, styled, useTheme } from "ol-components"
import type { MonthlyEngagementTrend } from "api/analytics-hooks/organizations"
import {
  EmptyTableMessage,
  MobileLabel,
  TableCell,
  TableFooter,
  TableFootnote,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from "@/components/B2BTable/B2BTable"
import { CATEGORICAL, chartInk } from "./chartPalette"
import {
  formatCount,
  formatYearMonth,
  formatYearMonthShort,
  SUPPRESSED_EXPLANATION,
  SuppressibleValue,
} from "./format"
import SectionError from "./SectionError"

/**
 * Monthly enrollment/engagement trend from `mv_b2b_monthly_engagement_trend`.
 *
 * # What is and isn't on this axis
 *
 * All three series are counts of *people*, so they share one linear axis. The
 * view also carries `total_videos_watched`, `total_problems_attempted` and
 * `total_chatbot_interactions` — those are counts of *events*, run three or
 * four orders of magnitude larger, and putting them here would need a second
 * y-scale. A dual-axis chart invites the reader to compare two things that were
 * never on the same scale, so they are deliberately left out; they are
 * reported by `ContentEngagementTable` instead, which pairs each with a
 * per-learner rate rather than plotting it.
 *
 * # Suppressed months
 *
 * `new_enrollments` and `certificates_earned` are nullable under the
 * k-anonymity floor. They are passed through to the chart as `null`, which the
 * line series renders as a genuine gap. Coercing them to 0 would draw a dip
 * that did not happen.
 *
 * # Why the chart is paired with a table
 *
 * The `<LineChart>` is an SVG of plotted geometry: a screen reader gets nothing
 * readable out of it, and a suppressed month is drawn as a gap that reads
 * identically to "no data". The table below carries the same monthly numbers as
 * text, where a suppressed value can say so in words. Same pairing, and same
 * reasoning, as `ProgramFunnelChart`.
 */

const ChartCard = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "24px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const TableWrapper = styled.div(({ theme }) => ({
  paddingTop: "24px",
  marginTop: "8px",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const CHART_HEIGHT = 320

const COLUMN_FLEX = {
  month: 1.4,
  active: 1.4,
  enrollments: 1.4,
  certificates: 1.6,
}

/** Drives both the chart series and the columns of the table beside it. */
const SERIES = [
  {
    key: "monthly_active_learners",
    column: "active",
    label: "Active learners",
    color: CATEGORICAL[0],
  },
  {
    key: "new_enrollments",
    column: "enrollments",
    label: "New enrollments",
    color: CATEGORICAL[1],
  },
  {
    key: "certificates_earned",
    column: "certificates",
    label: "Certificates earned",
    color: CATEGORICAL[2],
  },
] as const satisfies ReadonlyArray<{
  key: keyof MonthlyEngagementTrend
  column: keyof typeof COLUMN_FLEX
  label: string
  color: string
}>

const EngagementTrendChart: React.FC<{
  rows: MonthlyEngagementTrend[] | undefined
  isLoading: boolean
  isError?: boolean
}> = ({ rows, isLoading, isError }) => {
  // Above the early returns: hooks cannot be called conditionally.
  const ink = chartInk(useTheme())

  if (isError) {
    return (
      <ChartCard>
        <SectionError />
      </ChartCard>
    )
  }

  if (isLoading) {
    return (
      <ChartCard>
        <Skeleton variant="rectangular" width="100%" height={CHART_HEIGHT} />
      </ChartCard>
    )
  }

  if (!rows?.length) {
    return (
      <ChartCard>
        <EmptyTableMessage>No monthly activity recorded yet.</EmptyTableMessage>
      </ChartCard>
    )
  }

  // The API orders by activity_year_and_month, but sorting here keeps the chart
  // correct even if paging ever returns rows out of order.
  const months = [...rows].sort((a, b) =>
    a.activity_year_and_month.localeCompare(b.activity_year_and_month),
  )
  const labels = months.map((row) => row.activity_year_and_month)
  const hasSuppressed = months.some(
    (row) => row.new_enrollments === null || row.certificates_earned === null,
  )

  return (
    <ChartCard>
      {/* Hidden from assistive tech: the table below carries the same numbers
          as text, so leaving the SVG exposed only makes a screen reader walk
          hundreds of series and axis nodes to reach data it is about to be
          given properly. Safe to hide because the chart renders nothing
          focusable — asserted in the test, since burying a focusable node
          inside aria-hidden would be its own violation. */}
      <div aria-hidden>
        <LineChart
          height={CHART_HEIGHT}
          margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
          // Horizontal rules only: vertical ones would fight the marks for
          // attention without helping anyone read a monthly value.
          grid={{ horizontal: true }}
          xAxis={[
            {
              scaleType: "point",
              data: labels,
              valueFormatter: (value: string, context) =>
                // The tooltip has room for the year; a dense monthly axis does not.
                context.location === "tick"
                  ? formatYearMonthShort(value)
                  : formatYearMonth(value),
              tickLabelStyle: { fill: ink.label, fontSize: 12 },
            },
          ]}
          yAxis={[
            {
              min: 0,
              valueFormatter: (value: number) => formatCount(value),
              tickLabelStyle: { fill: ink.label, fontSize: 12 },
              width: 56,
            },
          ]}
          series={SERIES.map((series) => ({
            // `null` is meaningful here: a month suppressed by the anonymity
            // floor, drawn as a gap rather than a zero.
            data: months.map((row) => row[series.key] ?? null),
            label: series.label,
            color: series.color,
            curve: "linear",
            // A mark per month keeps single-point series visible and gives the
            // hover layer something bigger than a 2px line to aim at.
            showMark: true,
            valueFormatter: (value: number | null) =>
              value === null
                ? "Withheld (too few learners)"
                : formatCount(value),
          }))}
          sx={{
            "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
              stroke: ink.axis,
            },
            "& .MuiChartsGrid-line": { stroke: ink.grid },
            "& .MuiLineElement-root": { strokeWidth: 2 },
          }}
        />
      </div>
      <TableWrapper>
        <div role="table" aria-label="Monthly engagement">
          <div role="rowgroup">
            <TableHeaderRow role="row">
              <TableHeaderCell role="columnheader" $flex={COLUMN_FLEX.month}>
                Month
              </TableHeaderCell>
              {SERIES.map((series) => (
                <TableHeaderCell
                  key={series.key}
                  role="columnheader"
                  $flex={COLUMN_FLEX[series.column]}
                  $numeric
                >
                  {series.label}
                </TableHeaderCell>
              ))}
            </TableHeaderRow>
          </div>
          <div role="rowgroup">
            {months.map((row) => (
              <TableRow role="row" key={row.activity_year_and_month}>
                <TableCell role="cell" $flex={COLUMN_FLEX.month} $primary>
                  {formatYearMonth(row.activity_year_and_month)}
                </TableCell>
                {SERIES.map((series) => (
                  <TableCell
                    key={series.key}
                    role="cell"
                    $flex={COLUMN_FLEX[series.column]}
                    $numeric
                  >
                    <MobileLabel>{series.label}</MobileLabel>
                    <SuppressibleValue value={row[series.key]} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </div>
        </div>
        {hasSuppressed ? (
          <TableFooter>
            <TableFootnote>{SUPPRESSED_EXPLANATION}</TableFootnote>
          </TableFooter>
        ) : null}
      </TableWrapper>
    </ChartCard>
  )
}

export default EngagementTrendChart
