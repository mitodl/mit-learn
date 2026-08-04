"use client"

import React from "react"
import { Skeleton, styled, Typography } from "ol-components"
import type { EnrollmentCompletionFunnel } from "api/analytics-hooks/organizations"
import {
  EmptyTableMessage,
  MobileLabel,
  TableCard,
  TableCell,
  TableFooter,
  TableFootnote,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from "@/components/B2BTable/B2BTable"
import {
  formatCount,
  formatPercent,
  SUPPRESSED_EXPLANATION,
  SuppressibleValue,
} from "./format"
import SectionError from "./SectionError"

/**
 * Per-course-run performance from `mv_b2b_enrollment_completion_funnel`.
 *
 * Uses the same table primitives as the contract admin page so the two B2B
 * manager surfaces read as one product, including the below-`md` reflow where
 * each row becomes a stack of label/value pairs.
 */

const CourseTitle = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
  display: "block",
}))

const CourseId = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  display: "block",
}))

const ContractLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
  paddingTop: "8px",
})) as typeof Typography

const COLUMN_FLEX = {
  course: 3,
  enrolled: 1,
  active: 1,
  certified: 1,
  activeRate: 1.2,
  completionRate: 1.4,
}

const CoursePerformanceTable: React.FC<{
  rows: EnrollmentCompletionFunnel[] | undefined
  isLoading: boolean
  isError?: boolean
}> = ({ rows, isLoading, isError }) => {
  if (isError) {
    return (
      <TableCard>
        <SectionError />
      </TableCard>
    )
  }

  if (isLoading) {
    return (
      <TableCard>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            width="100%"
            height="44px"
            style={{ marginBottom: "8px" }}
          />
        ))}
      </TableCard>
    )
  }

  if (!rows?.length) {
    return (
      <TableCard>
        <EmptyTableMessage>
          No course enrollments recorded yet.
        </EmptyTableMessage>
      </TableCard>
    )
  }

  // The view's grain includes the contract, so a course run appears once per
  // contract it is offered under. Grouping by contract keeps those rows from
  // reading as duplicates; the label is dropped when there is only one.
  const contracts = new Map<number, EnrollmentCompletionFunnel[]>()
  rows.forEach((row) => {
    const existing = contracts.get(row.contract_pk)
    if (existing) {
      existing.push(row)
    } else {
      contracts.set(row.contract_pk, [row])
    }
  })
  const showContractLabels = contracts.size > 1
  const hasSuppressed = rows.some(
    (row) =>
      row.active_learners === null ||
      row.certified_learners === null ||
      row.passing_learners === null,
  )

  return (
    <TableCard>
      <div role="table" aria-label="Course performance">
        <div role="rowgroup">
          <TableHeaderRow role="row">
            <TableHeaderCell role="columnheader" $flex={COLUMN_FLEX.course}>
              Course
            </TableHeaderCell>
            <TableHeaderCell
              role="columnheader"
              $flex={COLUMN_FLEX.enrolled}
              $numeric
            >
              Enrolled
            </TableHeaderCell>
            <TableHeaderCell
              role="columnheader"
              $flex={COLUMN_FLEX.active}
              $numeric
            >
              Active
            </TableHeaderCell>
            <TableHeaderCell
              role="columnheader"
              $flex={COLUMN_FLEX.certified}
              $numeric
            >
              Certified
            </TableHeaderCell>
            <TableHeaderCell
              role="columnheader"
              $flex={COLUMN_FLEX.activeRate}
              $numeric
            >
              Active rate
            </TableHeaderCell>
            <TableHeaderCell
              role="columnheader"
              $flex={COLUMN_FLEX.completionRate}
              $numeric
            >
              Completion rate
            </TableHeaderCell>
          </TableHeaderRow>
        </div>
        <div role="rowgroup">
          {Array.from(contracts.values()).map((contractRows) => (
            <React.Fragment key={contractRows[0].contract_pk}>
              {showContractLabels ? (
                <ContractLabel>
                  {contractRows[0].b2b_contract_name}
                </ContractLabel>
              ) : null}
              {contractRows.map((row) => (
                <TableRow
                  role="row"
                  key={`${row.contract_pk}-${row.courserun_pk}`}
                >
                  <TableCell role="cell" $flex={COLUMN_FLEX.course} $primary>
                    <span>
                      <CourseTitle>{row.courserun_title}</CourseTitle>
                      <CourseId>{row.courserun_readable_id}</CourseId>
                    </span>
                  </TableCell>
                  <TableCell role="cell" $flex={COLUMN_FLEX.enrolled} $numeric>
                    <MobileLabel>Enrolled</MobileLabel>
                    {formatCount(row.enrolled_learners)}
                  </TableCell>
                  <TableCell role="cell" $flex={COLUMN_FLEX.active} $numeric>
                    <MobileLabel>Active</MobileLabel>
                    <SuppressibleValue value={row.active_learners} />
                  </TableCell>
                  <TableCell role="cell" $flex={COLUMN_FLEX.certified} $numeric>
                    <MobileLabel>Certified</MobileLabel>
                    <SuppressibleValue value={row.certified_learners} />
                  </TableCell>
                  <TableCell
                    role="cell"
                    $flex={COLUMN_FLEX.activeRate}
                    $numeric
                  >
                    <MobileLabel>Active rate</MobileLabel>
                    <SuppressibleValue
                      value={row.active_rate_pct}
                      format={formatPercent}
                    />
                  </TableCell>
                  <TableCell
                    role="cell"
                    $flex={COLUMN_FLEX.completionRate}
                    $numeric
                  >
                    <MobileLabel>Completion rate</MobileLabel>
                    <SuppressibleValue
                      value={row.completion_rate_pct}
                      format={formatPercent}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      {hasSuppressed ? (
        <TableFooter>
          <TableFootnote>{SUPPRESSED_EXPLANATION}</TableFootnote>
        </TableFooter>
      ) : null}
    </TableCard>
  )
}

export default CoursePerformanceTable
export { COLUMN_FLEX }
