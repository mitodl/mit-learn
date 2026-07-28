"use client"

import React from "react"
import { BarChart } from "@mui/x-charts/BarChart"
import { Skeleton, styled, Typography } from "ol-components"
import type { ProgramFunnel } from "api/analytics-hooks/organizations"
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
import { CHART_INK, FUNNEL_STAGES } from "./chartPalette"
import {
  formatCount,
  SUPPRESSED_EXPLANATION,
  SuppressibleValue,
} from "./format"
import SectionError from "./SectionError"

/**
 * Program funnel from `mv_b2b_program_funnel`.
 *
 * Stage order carries the meaning here — each stage is a subset of the one
 * before it — so the bars take a single-hue light-to-dark ramp rather than
 * three unrelated hues: the reader sees the progression in the color itself.
 *
 * The chart is paired with a table of the same numbers rather than treated as
 * the whole story. That table is what makes the exact values available to
 * screen readers, and it is where a value suppressed by the anonymity floor can
 * say so — a bar chart can only omit the bar, which reads as zero.
 */

const Card = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "24px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const ChartWrapper = styled.div(({ theme }) => ({
  // A long program title needs room; below md the chart scrolls sideways rather
  // than squeezing the labels into unreadable truncation.
  overflowX: "auto",
  [theme.breakpoints.down("md")]: {
    "> *": { minWidth: "560px" },
  },
}))

const TableWrapper = styled.div(({ theme }) => ({
  paddingTop: "24px",
  marginTop: "8px",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const ContractLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
  paddingTop: "8px",
})) as typeof Typography

const STAGES = [
  {
    key: "enrolled_in_contract_courses",
    label: "Enrolled in contract courses",
    color: FUNNEL_STAGES[0],
  },
  {
    key: "enrolled_via_program",
    label: "Enrolled via program",
    color: FUNNEL_STAGES[1],
  },
  {
    key: "program_course_completers",
    label: "Completed program courses",
    color: FUNNEL_STAGES[2],
  },
] as const

const COLUMN_FLEX = {
  program: 3,
  courses: 1,
  enrolled: 1.4,
  viaProgram: 1.4,
  completers: 1.6,
}

/** Bar thickness plus its gap, times three stages, plus room for the legend. */
const rowHeight = (programCount: number) =>
  Math.max(220, programCount * 104 + 72)

const ProgramFunnelChart: React.FC<{
  rows: ProgramFunnel[] | undefined
  isLoading: boolean
  isError?: boolean
}> = ({ rows, isLoading, isError }) => {
  if (isError) {
    return (
      <Card>
        <SectionError />
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <Skeleton variant="rectangular" width="100%" height={260} />
      </Card>
    )
  }

  if (!rows?.length) {
    return (
      <Card>
        <EmptyTableMessage>
          No program enrollments recorded yet.
        </EmptyTableMessage>
      </Card>
    )
  }

  const showContract = new Set(rows.map((row) => row.contract_pk)).size > 1
  // A program can appear under more than one contract, so the axis label has to
  // disambiguate or two distinct rows collapse into one visual band.
  const labels = rows.map((row) =>
    showContract
      ? `${row.program_title} (${row.b2b_contract_name})`
      : row.program_title,
  )
  const hasSuppressed = rows.some(
    (row) =>
      row.enrolled_via_program === null ||
      row.program_course_completers === null,
  )

  return (
    <Card>
      <ChartWrapper>
        <BarChart
          layout="horizontal"
          height={rowHeight(rows.length)}
          margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
          // Vertical rules only: on a horizontal bar chart they are the ones
          // that let a reader compare bar lengths.
          grid={{ vertical: true }}
          // Rounds the data end of each bar while it stays anchored to the
          // baseline.
          borderRadius={4}
          yAxis={[
            {
              scaleType: "band",
              data: labels,
              width: 220,
              tickLabelStyle: { fill: CHART_INK.label, fontSize: 12 },
              // A gap between category groups keeps adjacent programs from
              // reading as one block of bars.
              categoryGapRatio: 0.4,
              barGapRatio: 0.1,
            },
          ]}
          xAxis={[
            {
              min: 0,
              valueFormatter: (value: number) => formatCount(value),
              tickLabelStyle: { fill: CHART_INK.label, fontSize: 12 },
            },
          ]}
          series={STAGES.map((stage) => ({
            data: rows.map((row) => row[stage.key] ?? null),
            label: stage.label,
            color: stage.color,
            valueFormatter: (value: number | null) =>
              value === null
                ? "Withheld (too few learners)"
                : formatCount(value),
          }))}
          sx={{
            "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": {
              stroke: CHART_INK.axis,
            },
            "& .MuiChartsGrid-line": { stroke: CHART_INK.grid },
          }}
        />
      </ChartWrapper>
      <TableWrapper>
        <div role="table" aria-label="Program funnel">
          <div role="rowgroup">
            <TableHeaderRow role="row">
              <TableHeaderCell role="columnheader" $flex={COLUMN_FLEX.program}>
                Program
              </TableHeaderCell>
              <TableHeaderCell
                role="columnheader"
                $flex={COLUMN_FLEX.courses}
                $numeric
              >
                Courses
              </TableHeaderCell>
              <TableHeaderCell
                role="columnheader"
                $flex={COLUMN_FLEX.enrolled}
                $numeric
              >
                Enrolled in contract courses
              </TableHeaderCell>
              <TableHeaderCell
                role="columnheader"
                $flex={COLUMN_FLEX.viaProgram}
                $numeric
              >
                Enrolled via program
              </TableHeaderCell>
              <TableHeaderCell
                role="columnheader"
                $flex={COLUMN_FLEX.completers}
                $numeric
              >
                Completed program courses
              </TableHeaderCell>
            </TableHeaderRow>
          </div>
          <div role="rowgroup">
            {rows.map((row) => (
              <TableRow role="row" key={`${row.contract_pk}-${row.program_pk}`}>
                <TableCell role="cell" $flex={COLUMN_FLEX.program} $primary>
                  {row.program_title}
                  {showContract ? (
                    <ContractLabel component="span">
                      {" "}
                      · {row.b2b_contract_name}
                    </ContractLabel>
                  ) : null}
                </TableCell>
                <TableCell role="cell" $flex={COLUMN_FLEX.courses} $numeric>
                  <MobileLabel>Courses</MobileLabel>
                  {formatCount(row.total_courses)}
                </TableCell>
                <TableCell role="cell" $flex={COLUMN_FLEX.enrolled} $numeric>
                  <MobileLabel>Enrolled in contract courses</MobileLabel>
                  {formatCount(row.enrolled_in_contract_courses)}
                </TableCell>
                <TableCell role="cell" $flex={COLUMN_FLEX.viaProgram} $numeric>
                  <MobileLabel>Enrolled via program</MobileLabel>
                  <SuppressibleValue value={row.enrolled_via_program} />
                </TableCell>
                <TableCell role="cell" $flex={COLUMN_FLEX.completers} $numeric>
                  <MobileLabel>Completed program courses</MobileLabel>
                  <SuppressibleValue value={row.program_course_completers} />
                </TableCell>
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
    </Card>
  )
}

export default ProgramFunnelChart
