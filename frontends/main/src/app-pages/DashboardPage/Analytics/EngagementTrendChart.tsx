"use client"

import React from "react"
import { LineChart } from "@mui/x-charts/LineChart"
import { Skeleton, styled, Typography } from "ol-components"
import type { MonthlyEngagementTrend } from "api/analytics-hooks/organizations"
import { CATEGORICAL, CHART_INK } from "./chartPalette"
import { formatCount, formatYearMonth, formatYearMonthShort } from "./format"

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
 * never on the same scale, so they are deliberately left out; they belong in a
 * separate content-engagement panel.
 *
 * # Suppressed months
 *
 * `new_enrollments` and `certificates_earned` are nullable under the
 * k-anonymity floor. They are passed through to the chart as `null`, which the
 * line series renders as a genuine gap. Coercing them to 0 would draw a dip
 * that did not happen.
 */

const ChartCard = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "24px 24px 8px",
  [theme.breakpoints.down("md")]: {
    padding: "16px 8px 8px",
  },
}))

const EmptyMessage = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  padding: "32px 0",
  textAlign: "center",
})) as typeof Typography

const CHART_HEIGHT = 320

const SERIES = [
  {
    key: "monthly_active_learners",
    label: "Active learners",
    color: CATEGORICAL[0],
  },
  { key: "new_enrollments", label: "New enrollments", color: CATEGORICAL[1] },
  {
    key: "certificates_earned",
    label: "Certificates earned",
    color: CATEGORICAL[2],
  },
] as const

const EngagementTrendChart: React.FC<{
  rows: MonthlyEngagementTrend[] | undefined
  isLoading: boolean
}> = ({ rows, isLoading }) => {
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
        <EmptyMessage>No monthly activity recorded yet.</EmptyMessage>
      </ChartCard>
    )
  }

  // The API orders by activity_year_and_month, but sorting here keeps the chart
  // correct even if paging ever returns rows out of order.
  const months = [...rows].sort((a, b) =>
    a.activity_year_and_month.localeCompare(b.activity_year_and_month),
  )
  const labels = months.map((row) => row.activity_year_and_month)

  return (
    <ChartCard>
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
            tickLabelStyle: { fill: CHART_INK.label, fontSize: 12 },
          },
        ]}
        yAxis={[
          {
            min: 0,
            valueFormatter: (value: number) => formatCount(value),
            tickLabelStyle: { fill: CHART_INK.label, fontSize: 12 },
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
            value === null ? "Withheld (too few learners)" : formatCount(value),
        }))}
        sx={{
          "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
            stroke: CHART_INK.axis,
          },
          "& .MuiChartsGrid-line": { stroke: CHART_INK.grid },
          "& .MuiLineElement-root": { strokeWidth: 2 },
        }}
      />
    </ChartCard>
  )
}

export default EngagementTrendChart
